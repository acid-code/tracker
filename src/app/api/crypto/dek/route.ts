import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { jsonError, jsonOk, requireUser } from "@/lib/api";

const DEK_FILENAME = "recomp-dek-v1.json";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

async function getGoogleTokens(userId: string) {
  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: and(
      eq(schema.accounts.userId, userId),
      eq(schema.accounts.provider, "google"),
    ),
  });
  if (!account?.refresh_token && !account?.access_token) {
    return null;
  }
  return account;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { access_token: string };
}

async function accessTokenFor(userId: string) {
  const account = await getGoogleTokens(userId);
  if (!account) return null;
  if (account.refresh_token) {
    try {
      const { access_token } = await refreshAccessToken(account.refresh_token);
      return access_token;
    } catch {
      /* fall through */
    }
  }
  return account.access_token;
}

async function findDekFileId(accessToken: string) {
  const q = encodeURIComponent(
    `name='${DEK_FILENAME}' and 'appDataFolder' in parents and trashed=false`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive list failed: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

/** GET — return DEK from Drive appData (never stored in Turso). */
export async function GET() {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  try {
    const accessToken = await accessTokenFor(authz.userId);
    if (!accessToken) {
      return jsonError(
        "Google Drive access missing — sign out and sign in again to grant Drive app data.",
        403,
      );
    }
    const fileId = await findDekFileId(accessToken);
    if (!fileId) return jsonOk({ dek: null, needsConsent: false });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const text = await res.text();
      return jsonError(`Drive read failed: ${text.slice(0, 200)}`, 502);
    }
    const data = (await res.json()) as { dek?: string };
    return jsonOk({ dek: data.dek ?? null, needsConsent: false });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Drive DEK read failed",
      502,
    );
  }
}

/** PUT — write DEK to Drive appData. Body: { dek: base64 }. */
export async function PUT(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const body = await req.json();
  const dek = String(body.dek || "");
  if (!dek || dek.length < 16) return jsonError("Invalid dek");

  try {
    const accessToken = await accessTokenFor(authz.userId);
    if (!accessToken) {
      return jsonError(
        "Google Drive access missing — sign out and sign in again to grant Drive app data.",
        403,
      );
    }

    const payload = JSON.stringify({ dek, v: 1 });
    const existingId = await findDekFileId(accessToken);

    if (existingId) {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: payload,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return jsonError(`Drive update failed: ${text.slice(0, 200)}`, 502);
      }
    } else {
      const meta = {
        name: DEK_FILENAME,
        parents: ["appDataFolder"],
      };
      const boundary = "recomp_boundary";
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        `${payload}\r\n` +
        `--${boundary}--`;
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipart,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return jsonError(`Drive create failed: ${text.slice(0, 200)}`, 502);
      }
    }

    return jsonOk({ ok: true, scopeHint: DRIVE_SCOPE });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Drive DEK write failed",
      502,
    );
  }
}
