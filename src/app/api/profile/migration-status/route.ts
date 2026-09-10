import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { jsonError, jsonOk, requireUser } from "@/lib/api";

export async function PUT(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const body = await req.json();
  const status = String(body.migrationStatus || "");
  if (!["pending", "dual_write", "verified", "plaintext_retired"].includes(status)) {
    return jsonError("Invalid migrationStatus");
  }

  const db = await getDb();
  const existing = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, authz.userId),
  });
  if (!existing) return jsonError("No profile", 404);

  /** Never allow client to jump to plaintext_retired in v1. */
  const next =
    status === "plaintext_retired" ? existing.migrationStatus ?? "verified" : status;

  await db
    .update(schema.profiles)
    .set({ migrationStatus: next, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, authz.userId));

  return jsonOk({ migrationStatus: next });
}
