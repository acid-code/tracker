import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { jsonError, jsonOk, requireUser } from "@/lib/api";
import {
  suggestTargetsFromGoal,
  suggestionIsStale,
  type GoalMode,
} from "@/lib/goal-suggest";
import {
  ensureSeedTargetPlan,
  listTargetPlans,
  profileToForTargets,
  upsertTargetPlan,
} from "@/lib/target-plans";
import {
  ACTIVITY_OPTIONS,
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_PROTEIN_PER_KG,
  clampDeficit,
  clampEnergyDelta,
  resolveTargets,
  resolveTargetsForDate,
  todayISODate,
  type ActivityLevel,
  type Sex,
} from "@/lib/tdee";

async function profilePayload(
  userId: string,
  profile: typeof schema.profiles.$inferSelect,
  date = todayISODate(),
) {
  const plans = await ensureSeedTargetPlan(userId, profile);
  const forTargets = profileToForTargets(profile);
  const targets = resolveTargetsForDate(forTargets, plans, date);
  const live = resolveTargets(forTargets);
  const stale = suggestionIsStale({
    suggestedBasedOnWeightKg: profile.suggestedBasedOnWeightKg,
    suggestedBasedOnBf: profile.suggestedBasedOnBf,
    suggestedBasedOnActivity: profile.suggestedBasedOnActivity,
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent,
    activityLevel: profile.activityLevel,
  });
  return {
    userId,
    profile,
    targets,
    liveTargets: live,
    plans,
    suggestionStale: stale,
    needsBodyFat: profile.bodyFatPercent == null,
  };
}

function parseOverride(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayISODate();

  const db = await getDb();
  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, authz.userId),
  });

  if (!profile || !profile.weightKg || profile.bodyFatPercent == null) {
    return jsonOk({
      userId: authz.userId,
      profile: profile ?? null,
      targets: null,
      liveTargets: null,
      plans: [],
      suggestionStale: false,
      needsBodyFat: !profile?.bodyFatPercent,
    });
  }

  return jsonOk(await profilePayload(authz.userId, profile, date));
}

export async function PUT(req: Request) {
  const authz = await requireUser();
  if ("error" in authz) return authz.error;

  const body = await req.json();
  const db = await getDb();
  const existing = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, authz.userId),
  });

  const clientDate =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : todayISODate();

  /** Refresh suggestion from goal text + body stats (does not append a plan). */
  if (body.refreshSuggestion === true && existing) {
    if (!existing.weightKg || existing.bodyFatPercent == null) {
      return jsonError("Profile incomplete");
    }
    const goalTarget =
      body.goalTarget !== undefined
        ? body.goalTarget === null || body.goalTarget === ""
          ? null
          : String(body.goalTarget).trim().slice(0, 500)
        : existing.goalTarget;
    const suggested = suggestTargetsFromGoal({
      goalTarget,
      weightKg: existing.weightKg,
      bodyFatPercent: existing.bodyFatPercent,
      activityLevel: (existing.activityLevel ?? "moderate") as ActivityLevel,
      sex: (existing.sex as Sex | null) ?? null,
      mode: body.goalMode as GoalMode | undefined,
    });
    const values = {
      goalTarget,
      suggestedGoalMode: suggested.mode,
      suggestedCalorieTarget: suggested.calorieTarget,
      suggestedProteinG: suggested.proteinG,
      suggestedFatG: suggested.fatG,
      suggestedDeficitKcal: suggested.deficit,
      suggestedRationale: suggested.rationale,
      suggestedAt: new Date(),
      suggestedBasedOnWeightKg: suggested.basedOnWeightKg,
      suggestedBasedOnBf: suggested.basedOnBodyFatPercent,
      suggestedBasedOnActivity: suggested.basedOnActivityLevel,
      deficitKcal: clampEnergyDelta(suggested.deficit),
      updatedAt: new Date(),
    };
    await db
      .update(schema.profiles)
      .set(values)
      .where(eq(schema.profiles.userId, authz.userId));
    const profile = { ...existing, ...values };
    return jsonOk(await profilePayload(authz.userId, profile, clientDate));
  }

  /** Apply saved suggestion or custom macros as a plan from today. */
  if (body.applyPlan === true && existing) {
    const calorieTargetOverride = parseOverride(body.calorieTargetOverride);
    const proteinTargetOverride = parseOverride(body.proteinTargetOverride);
    const fatTargetOverride = parseOverride(body.fatTargetOverride);
    if (
      (calorieTargetOverride != null &&
        (!Number.isFinite(calorieTargetOverride) ||
          calorieTargetOverride <= 0)) ||
      (proteinTargetOverride != null &&
        (!Number.isFinite(proteinTargetOverride) ||
          proteinTargetOverride <= 0)) ||
      (fatTargetOverride != null &&
        (!Number.isFinite(fatTargetOverride) || fatTargetOverride <= 0))
    ) {
      return jsonError("Invalid target overrides");
    }

    const useSuggestion = body.useSuggestion === true;
    let calorieTarget: number;
    let proteinG: number;
    let fatG: number;
    let carbsG: number;
    let tdee: number;
    let deficitKcal: number;
    let goalMode: string | null;
    let source: "override" | "apply_suggestion" = "override";

    if (useSuggestion && existing.suggestedCalorieTarget != null) {
      calorieTarget = existing.suggestedCalorieTarget;
      proteinG = existing.suggestedProteinG ?? 0;
      fatG = existing.suggestedFatG ?? 0;
      const proteinKcal = proteinG * 4;
      carbsG = Math.round(
        Math.max(0, calorieTarget - proteinKcal - fatG * 9) / 4,
      );
      const live = resolveTargets(profileToForTargets(existing));
      tdee = live?.tdee ?? calorieTarget + (existing.suggestedDeficitKcal ?? 0);
      deficitKcal = existing.suggestedDeficitKcal ?? tdee - calorieTarget;
      goalMode = existing.suggestedGoalMode;
      source = "apply_suggestion";
    } else {
      const forTargets = profileToForTargets({
        ...existing,
        calorieTargetOverride,
        proteinTargetOverride,
        fatTargetOverride,
      });
      const live = resolveTargets(forTargets);
      if (!live) return jsonError("Cannot resolve targets");
      calorieTarget = live.calorieTarget;
      proteinG = live.proteinG;
      fatG = live.fatG;
      carbsG = live.carbsG;
      tdee = live.tdee;
      deficitKcal = live.deficit;
      goalMode = existing.suggestedGoalMode;
    }

    const values = {
      calorieTargetOverride: useSuggestion ? calorieTarget : calorieTargetOverride,
      proteinTargetOverride: useSuggestion ? proteinG : proteinTargetOverride,
      fatTargetOverride: useSuggestion ? fatG : fatTargetOverride,
      ...(body.goalTarget !== undefined
        ? {
            goalTarget:
              body.goalTarget === null || body.goalTarget === ""
                ? null
                : String(body.goalTarget).trim().slice(0, 500),
          }
        : {}),
      updatedAt: new Date(),
    };
    await db
      .update(schema.profiles)
      .set(values)
      .where(eq(schema.profiles.userId, authz.userId));

    await upsertTargetPlan({
      userId: authz.userId,
      effectiveFrom: clientDate,
      calorieTarget,
      proteinG,
      fatG,
      carbsG,
      tdee,
      deficitKcal,
      goalMode,
      source,
    });

    const profile = { ...existing, ...values };
    return jsonOk(await profilePayload(authz.userId, profile, clientDate));
  }

  const isNutritionOnly =
    body.nutritionOnly === true ||
    (body.weightKg == null && existing != null);

  if (isNutritionOnly && existing) {
    const calorieTargetOverride = parseOverride(
      body.calorieTargetOverride !== undefined
        ? body.calorieTargetOverride
        : existing.calorieTargetOverride,
    );
    const proteinTargetOverride = parseOverride(
      body.proteinTargetOverride !== undefined
        ? body.proteinTargetOverride
        : existing.proteinTargetOverride,
    );
    const fatTargetOverride = parseOverride(
      body.fatTargetOverride !== undefined
        ? body.fatTargetOverride
        : existing.fatTargetOverride,
    );

    if (
      calorieTargetOverride != null &&
      (!Number.isFinite(calorieTargetOverride) || calorieTargetOverride <= 0)
    ) {
      return jsonError("Invalid calorie target");
    }
    if (
      proteinTargetOverride != null &&
      (!Number.isFinite(proteinTargetOverride) || proteinTargetOverride <= 0)
    ) {
      return jsonError("Invalid protein target");
    }
    if (
      fatTargetOverride != null &&
      (!Number.isFinite(fatTargetOverride) || fatTargetOverride <= 0)
    ) {
      return jsonError("Invalid fat target");
    }

    const values = {
      calorieTargetOverride,
      proteinTargetOverride,
      fatTargetOverride,
      countryCode: body.countryCode ?? existing.countryCode ?? "il",
      ...(body.goalTarget !== undefined
        ? {
            goalTarget:
              body.goalTarget === null || body.goalTarget === ""
                ? null
                : String(body.goalTarget).trim().slice(0, 500),
          }
        : {}),
      updatedAt: new Date(),
    };

    await db
      .update(schema.profiles)
      .set(values)
      .where(eq(schema.profiles.userId, authz.userId));

    if (body.appendPlan === true) {
      const forTargets = profileToForTargets({ ...existing, ...values });
      const live = resolveTargets(forTargets);
      if (live) {
        await upsertTargetPlan({
          userId: authz.userId,
          effectiveFrom: clientDate,
          calorieTarget: live.calorieTarget,
          proteinG: live.proteinG,
          fatG: live.fatG,
          carbsG: live.carbsG,
          tdee: live.tdee,
          deficitKcal: live.deficit,
          goalMode: existing.suggestedGoalMode,
          source: "override",
        });
      }
    }

    const profile = { ...existing, ...values };
    return jsonOk(await profilePayload(authz.userId, profile, clientDate));
  }

  const weightKg = Number(body.weightKg);
  const heightCm = Number(body.heightCm);
  const age = Number(body.age);
  const sex = body.sex as Sex;
  const bodyFatPercent = Number(body.bodyFatPercent);
  let activityLevel = (body.activityLevel ?? "moderate") as ActivityLevel;
  if (!ACTIVITY_OPTIONS.includes(activityLevel) && activityLevel !== "very_active") {
    activityLevel = "moderate";
  }
  const deficitRaw = Number(body.deficitKcal ?? DEFAULT_DEFICIT_KCAL);
  const deficitKcal = body.allowAnyDeficit
    ? clampEnergyDelta(deficitRaw)
    : clampDeficit(deficitRaw);
  const proteinPerKg = Number(
    body.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG,
  );

  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(age) ||
    (sex !== "male" && sex !== "female")
  ) {
    return jsonError("Invalid profile fields");
  }
  if (
    !Number.isFinite(bodyFatPercent) ||
    bodyFatPercent < 3 ||
    bodyFatPercent > 60
  ) {
    return jsonError("Body fat % is required (3–60)");
  }

  const goalTarget =
    body.goalTarget !== undefined
      ? body.goalTarget === null || body.goalTarget === ""
        ? null
        : String(body.goalTarget).trim().slice(0, 500)
      : (existing?.goalTarget ?? null);

  let suggestionFields: Record<string, unknown> = {};
  if (body.refreshSuggestion !== false) {
    const suggested = suggestTargetsFromGoal({
      goalTarget,
      weightKg,
      bodyFatPercent,
      activityLevel,
      sex,
    });
    suggestionFields = {
      suggestedGoalMode: suggested.mode,
      suggestedCalorieTarget: suggested.calorieTarget,
      suggestedProteinG: suggested.proteinG,
      suggestedFatG: suggested.fatG,
      suggestedDeficitKcal: suggested.deficit,
      suggestedRationale: suggested.rationale,
      suggestedAt: new Date(),
      suggestedBasedOnWeightKg: suggested.basedOnWeightKg,
      suggestedBasedOnBf: suggested.basedOnBodyFatPercent,
      suggestedBasedOnActivity: suggested.basedOnActivityLevel,
      deficitKcal: clampEnergyDelta(suggested.deficit),
    };
  }

  const values = {
    userId: authz.userId,
    weightKg,
    heightCm,
    age,
    sex,
    bodyFatPercent,
    activityLevel,
    deficitKcal:
      (suggestionFields.deficitKcal as number | undefined) ?? deficitKcal,
    proteinPerKg,
    countryCode: body.countryCode ?? existing?.countryCode ?? "il",
    calorieTargetOverride: existing?.calorieTargetOverride ?? null,
    proteinTargetOverride: existing?.proteinTargetOverride ?? null,
    fatTargetOverride: existing?.fatTargetOverride ?? null,
    goalTarget,
    ...suggestionFields,
    migrationStatus: existing?.migrationStatus ?? "pending",
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(schema.profiles)
      .set(values)
      .where(eq(schema.profiles.userId, authz.userId));
  } else {
    await db.insert(schema.profiles).values(values);
  }

  const weightChanged =
    !existing || existing.weightKg == null || existing.weightKg !== weightKg;
  if (weightChanged) {
    const date = clientDate;
    const todayLog = await db.query.weightLogs.findFirst({
      where: and(
        eq(schema.weightLogs.userId, authz.userId),
        eq(schema.weightLogs.date, date),
      ),
    });
    if (todayLog) {
      await db
        .update(schema.weightLogs)
        .set({ weightKg })
        .where(eq(schema.weightLogs.id, todayLog.id));
    } else {
      await db.insert(schema.weightLogs).values({
        userId: authz.userId,
        date,
        weightKg,
      });
    }
  }

  const profile = values as typeof schema.profiles.$inferSelect;
  if (!existing) {
    const live = resolveTargets(profileToForTargets(profile));
    if (live) {
      await upsertTargetPlan({
        userId: authz.userId,
        effectiveFrom: clientDate,
        calorieTarget: live.calorieTarget,
        proteinG: live.proteinG,
        fatG: live.fatG,
        carbsG: live.carbsG,
        tdee: live.tdee,
        deficitKcal: live.deficit,
        goalMode: profile.suggestedGoalMode,
        source: "seed",
      });
    }
  }

  return jsonOk(await profilePayload(authz.userId, profile, clientDate));
}
