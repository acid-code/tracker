import { and, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { jsonError, jsonOk, requireUser } from "@/lib/api";
import { SERVER_RETENTION_DAYS } from "@/lib/local-store";
import { todayISODate } from "@/lib/tdee";

function shiftDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const db = await getDb();

  if (domain && date) {
    const row = await db.query.encryptedBlobs.findFirst({
      where: and(
        eq(schema.encryptedBlobs.userId, authz.userId),
        eq(schema.encryptedBlobs.domain, domain),
        eq(schema.encryptedBlobs.date, date),
      ),
    });
    return jsonOk({ blob: row ?? null });
  }

  if (domain && from && to) {
    const rows = await db.query.encryptedBlobs.findMany({
      where: and(
        eq(schema.encryptedBlobs.userId, authz.userId),
        eq(schema.encryptedBlobs.domain, domain),
      ),
    });
    const filtered = rows.filter((r) => r.date >= from && r.date <= to);
    return jsonOk({ blobs: filtered });
  }

  const rows = await db.query.encryptedBlobs.findMany({
    where: eq(schema.encryptedBlobs.userId, authz.userId),
  });
  return jsonOk({ blobs: rows });
}

export async function PUT(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const body = await req.json();
  const domain = String(body.domain || "");
  const date = String(body.date || "");
  const iv = String(body.iv || "");
  const ciphertext = String(body.ciphertext || "");
  const deviceId =
    body.deviceId == null ? null : String(body.deviceId).slice(0, 80);

  if (!domain || !date || !iv || !ciphertext) {
    return jsonError("domain, date, iv, ciphertext required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError("Invalid date");
  }

  const db = await getDb();
  const existing = await db.query.encryptedBlobs.findFirst({
    where: and(
      eq(schema.encryptedBlobs.userId, authz.userId),
      eq(schema.encryptedBlobs.domain, domain),
      eq(schema.encryptedBlobs.date, date),
    ),
  });

  const values = {
    deviceId,
    iv,
    ciphertext,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(schema.encryptedBlobs)
      .set(values)
      .where(eq(schema.encryptedBlobs.id, existing.id));
  } else {
    await db.insert(schema.encryptedBlobs).values({
      userId: authz.userId,
      domain,
      date,
      ...values,
    });
  }

  if (deviceId) {
    const dev = await db.query.userDevices.findFirst({
      where: and(
        eq(schema.userDevices.userId, authz.userId),
        eq(schema.userDevices.deviceId, deviceId),
      ),
    });
    if (dev) {
      await db
        .update(schema.userDevices)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.userDevices.id, dev.id));
    } else {
      await db.insert(schema.userDevices).values({
        userId: authz.userId,
        deviceId,
        label: body.deviceLabel ? String(body.deviceLabel).slice(0, 80) : null,
      });
    }
  }

  /** Prune older than 1y for this user. */
  const cutoff = shiftDays(todayISODate(), -SERVER_RETENTION_DAYS);
  await db
    .delete(schema.encryptedBlobs)
    .where(
      and(
        eq(schema.encryptedBlobs.userId, authz.userId),
        lt(schema.encryptedBlobs.date, cutoff),
      ),
    );

  return jsonOk({ ok: true });
}
