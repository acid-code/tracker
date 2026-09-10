import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { jsonOk, requireUser } from "@/lib/api";
import { listTargetPlans } from "@/lib/target-plans";

/** Download escape hatch — plaintext export while dual mode is active. */
export async function GET() {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const db = await getDb();
  const userId = authz.userId;

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
  });
  const plans = await listTargetPlans(userId);
  const weightLogs = await db.query.weightLogs.findMany({
    where: eq(schema.weightLogs.userId, userId),
    orderBy: [desc(schema.weightLogs.date)],
    limit: 400,
  });
  const sleepLogs = await db.query.sleepLogs.findMany({
    where: eq(schema.sleepLogs.userId, userId),
    orderBy: [desc(schema.sleepLogs.date)],
    limit: 400,
  });
  const foodLogs = await db.query.foodLogs.findMany({
    where: eq(schema.foodLogs.userId, userId),
    orderBy: [desc(schema.foodLogs.date)],
    limit: 5000,
  });
  const sessions = await db.query.workoutSessions.findMany({
    where: eq(schema.workoutSessions.userId, userId),
    orderBy: [desc(schema.workoutSessions.date)],
    limit: 500,
  });

  return jsonOk({
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    plans,
    weightLogs,
    sleepLogs,
    foodLogs,
    workoutSessions: sessions,
    note: "Personal export. Dual-mode backup keeps server plaintext until you request retirement.",
  });
}
