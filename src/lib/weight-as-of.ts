import { and, desc, eq, lte } from "drizzle-orm";
import type { getDb } from "@/db";
import { schema } from "@/db";

/** Last weight log on or before date; else profile weight. */
export async function weightAsOf(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  date: string,
) {
  const weightLog = await db.query.weightLogs.findFirst({
    where: and(
      eq(schema.weightLogs.userId, userId),
      lte(schema.weightLogs.date, date),
    ),
    orderBy: [desc(schema.weightLogs.date)],
  });
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
  });
  return {
    bodyWeightKg: weightLog?.weightKg ?? profile?.weightKg ?? null,
    profileWeightKg: profile?.weightKg ?? null,
    weightLogDate: weightLog?.date ?? null,
  };
}
