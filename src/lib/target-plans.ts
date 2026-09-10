import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_PROTEIN_PER_KG,
  resolveTargets,
  todayISODate,
  type ActivityLevel,
  type ProfileForTargets,
  type Sex,
  type TargetPlanRow,
} from "@/lib/tdee";

export function profileToForTargets(profile: {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: string | null;
  bodyFatPercent: number | null;
  activityLevel: string | null;
  deficitKcal: number | null;
  proteinPerKg: number | null;
  calorieTargetOverride: number | null;
  proteinTargetOverride: number | null;
  fatTargetOverride?: number | null;
  suggestedCalorieTarget?: number | null;
  suggestedProteinG?: number | null;
  suggestedFatG?: number | null;
  suggestedDeficitKcal?: number | null;
  suggestedGoalMode?: string | null;
}): ProfileForTargets {
  return {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    sex: (profile.sex as Sex | null) ?? null,
    bodyFatPercent: profile.bodyFatPercent,
    activityLevel: (profile.activityLevel ?? "moderate") as ActivityLevel,
    deficitKcal: profile.deficitKcal ?? DEFAULT_DEFICIT_KCAL,
    proteinPerKg: profile.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG,
    calorieTargetOverride: profile.calorieTargetOverride ?? null,
    proteinTargetOverride: profile.proteinTargetOverride ?? null,
    fatTargetOverride: profile.fatTargetOverride ?? null,
    suggestedCalorieTarget: profile.suggestedCalorieTarget ?? null,
    suggestedProteinG: profile.suggestedProteinG ?? null,
    suggestedFatG: profile.suggestedFatG ?? null,
    suggestedDeficitKcal: profile.suggestedDeficitKcal ?? null,
    suggestedGoalMode: profile.suggestedGoalMode ?? null,
  };
}

export async function listTargetPlans(userId: string): Promise<TargetPlanRow[]> {
  const db = await getDb();
  const rows = await db.query.targetPlans.findMany({
    where: eq(schema.targetPlans.userId, userId),
    orderBy: [asc(schema.targetPlans.effectiveFrom)],
  });
  return rows.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    calorieTarget: r.calorieTarget,
    proteinG: r.proteinG,
    fatG: r.fatG,
    carbsG: r.carbsG,
    tdee: r.tdee,
    deficitKcal: r.deficitKcal,
    goalMode: r.goalMode,
  }));
}

export async function upsertTargetPlan(input: {
  userId: string;
  effectiveFrom?: string;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  tdee: number;
  deficitKcal: number;
  goalMode?: string | null;
  source: "override" | "apply_suggestion" | "seed" | "suggest_apply";
}) {
  const db = await getDb();
  const effectiveFrom = input.effectiveFrom ?? todayISODate();
  const existing = await db.query.targetPlans.findFirst({
    where: and(
      eq(schema.targetPlans.userId, input.userId),
      eq(schema.targetPlans.effectiveFrom, effectiveFrom),
    ),
  });
  const values = {
    calorieTarget: Math.round(input.calorieTarget),
    proteinG: Math.round(input.proteinG),
    fatG: Math.round(input.fatG),
    carbsG: Math.round(input.carbsG),
    tdee: Math.round(input.tdee),
    deficitKcal: Math.round(input.deficitKcal),
    goalMode: input.goalMode ?? null,
    source: input.source,
  };
  if (existing) {
    await db
      .update(schema.targetPlans)
      .set(values)
      .where(eq(schema.targetPlans.id, existing.id));
    return { ...existing, ...values, effectiveFrom };
  }
  const [row] = await db
    .insert(schema.targetPlans)
    .values({
      userId: input.userId,
      effectiveFrom,
      ...values,
    })
    .returning();
  return row;
}

/** Seed one plan from current resolved targets if user has none. */
export async function ensureSeedTargetPlan(
  userId: string,
  profile: Parameters<typeof profileToForTargets>[0],
) {
  const db = await getDb();
  const any = await db.query.targetPlans.findFirst({
    where: eq(schema.targetPlans.userId, userId),
  });
  if (any) return listTargetPlans(userId);

  const targets = resolveTargets(profileToForTargets(profile));
  if (!targets) return [];

  let effectiveFrom = todayISODate();
  const earliestFood = await db
    .select({ date: schema.foodLogs.date })
    .from(schema.foodLogs)
    .where(eq(schema.foodLogs.userId, userId))
    .orderBy(asc(schema.foodLogs.date))
    .limit(1);
  if (earliestFood[0]?.date) effectiveFrom = earliestFood[0].date;

  await upsertTargetPlan({
    userId,
    effectiveFrom,
    calorieTarget: targets.calorieTarget,
    proteinG: targets.proteinG,
    fatG: targets.fatG,
    carbsG: targets.carbsG,
    tdee: targets.tdee,
    deficitKcal: targets.deficit,
    goalMode: profile.suggestedGoalMode ?? null,
    source: "seed",
  });
  return listTargetPlans(userId);
}
