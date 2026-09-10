export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

/** Standard Harris-Benedict-style activity multipliers (EEE is tracked separately). */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.725, // treated as Active; TDEE already covers baseline training
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light (1–3×/week)",
  moderate: "Moderate (3–5×/week)",
  active: "Active (6–7×/week)",
  very_active: "Active (6–7×/week)",
};

/** Primary options shown in the UI (4 standard multipliers). */
export const ACTIVITY_OPTIONS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
];

export const DEFAULT_DEFICIT_KCAL = 400;
/** Evidence-based recomp protein range (g per kg body weight). */
export const PROTEIN_PER_KG_MIN = 1.61;
export const PROTEIN_PER_KG_GOOD = 1.85;
export const PROTEIN_PER_KG_MAX = 2.2;
/** Planning rate inside the range (macro split); not a hard ceiling. */
export const DEFAULT_PROTEIN_PER_KG = PROTEIN_PER_KG_GOOD;
export const FAT_CALORIE_FRACTION = 0.25;

/** Daily fiber targets (g) — lower bound for tracking; range for coaching copy. */
export function fiberTargetsFromSex(sex: Sex | null | undefined) {
  if (sex === "male") return { fiberG: 35, fiberMinG: 35, fiberMaxG: 45 };
  if (sex === "female") return { fiberG: 25, fiberMinG: 25, fiberMaxG: 35 };
  return { fiberG: 30, fiberMinG: 25, fiberMaxG: 45 };
}

export function proteinRangeFromWeight(weightKg: number) {
  return {
    minG: Math.round(weightKg * PROTEIN_PER_KG_MIN),
    goodG: Math.round(weightKg * PROTEIN_PER_KG_GOOD),
    maxG: Math.round(weightKg * PROTEIN_PER_KG_MAX),
  };
}

/** Lean body mass from total weight and body-fat %. */
export function leanBodyMassKg(weightKg: number, bodyFatPercent: number) {
  const bf = Math.min(60, Math.max(3, bodyFatPercent));
  return weightKg * (1 - bf / 100);
}

/**
 * Katch-McArdle BMR (kcal/day).
 * BMR = 370 + (21.6 × LeanBodyMassKg)
 */
export function bmrKatchMcArdle(leanMassKg: number) {
  return 370 + 21.6 * leanMassKg;
}

/** @deprecated Prefer bmrKatchMcArdle — kept for reference only. */
export function bmrMifflin({
  weightKg,
  heightCm,
  age,
  sex,
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function calcTdeeFromBmr(bmr: number, activityLevel: ActivityLevel) {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function clampDeficit(deficit: number) {
  // Garthe et al. 2011–aligned recomp deficit (~400 kcal); allow narrow band for overrides
  return Math.min(500, Math.max(300, Math.round(deficit)));
}

/** Energy delta vs TDEE: cut/recomp positive, maintain 0, bulk negative (surplus). */
export function clampEnergyDelta(deficit: number) {
  return Math.min(800, Math.max(-600, Math.round(deficit)));
}

export function calcTargets(input: {
  weightKg: number;
  bodyFatPercent: number;
  activityLevel: ActivityLevel;
  deficitKcal?: number;
  proteinPerKg?: number;
  sex?: Sex | null;
  /** When true, allow maintain (0) and surplus (negative) instead of 300–500 band. */
  allowAnyDeficit?: boolean;
}) {
  const lbm = leanBodyMassKg(input.weightKg, input.bodyFatPercent);
  const bmr = bmrKatchMcArdle(lbm);
  const tdee = calcTdeeFromBmr(bmr, input.activityLevel);
  const raw = input.deficitKcal ?? DEFAULT_DEFICIT_KCAL;
  const deficit = input.allowAnyDeficit
    ? clampEnergyDelta(raw)
    : clampDeficit(raw);
  const calorieTarget = Math.max(1200, tdee - deficit);

  const range = proteinRangeFromWeight(input.weightKg);
  /** Prefer explicit rate; otherwise plan at the "good" point in the range. */
  const proteinPerKg = input.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG;
  const proteinG = Math.round(input.weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;

  const fatKcal = calorieTarget * FAT_CALORIE_FRACTION;
  const fatG = Math.round(fatKcal / 9);

  const carbKcal = Math.max(0, calorieTarget - proteinKcal - fatG * 9);
  const carbsG = Math.round(carbKcal / 4);
  const fiber = fiberTargetsFromSex(input.sex);

  return {
    leanBodyMassKg: Math.round(lbm * 10) / 10,
    bodyFatPercent: input.bodyFatPercent,
    bmr: Math.round(bmr),
    tdee,
    deficit,
    calorieTarget,
    proteinG,
    proteinMinG: range.minG,
    proteinGoodG: range.goodG,
    proteinMaxG: range.maxG,
    carbsG,
    fatG,
    ...fiber,
    proteinPerKg,
  };
}

/** Local calendar YYYY-MM-DD (not UTC — avoids evening day-drift). */
export function todayISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ProfileForTargets = {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: "male" | "female" | null;
  bodyFatPercent: number | null;
  activityLevel: ActivityLevel | null;
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
};

export type TargetPlanRow = {
  effectiveFrom: string;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  tdee: number;
  deficitKcal: number;
  goalMode?: string | null;
};

/** Latest plan with effectiveFrom <= date. */
export function planForDate(
  plans: TargetPlanRow[] | null | undefined,
  date: string,
): TargetPlanRow | null {
  if (!plans?.length) return null;
  let best: TargetPlanRow | null = null;
  for (const p of plans) {
    if (p.effectiveFrom <= date) {
      if (!best || p.effectiveFrom > best.effectiveFrom) best = p;
    }
  }
  return best;
}

export function resolveTargets(profile: ProfileForTargets) {
  if (!profile.weightKg || profile.bodyFatPercent == null) {
    return null;
  }
  if (
    !Number.isFinite(profile.bodyFatPercent) ||
    profile.bodyFatPercent <= 0 ||
    profile.bodyFatPercent >= 70
  ) {
    return null;
  }

  const allowAny =
    profile.deficitKcal != null &&
    (profile.deficitKcal < 300 || profile.deficitKcal > 500);
  const computed = calcTargets({
    weightKg: profile.weightKg,
    bodyFatPercent: profile.bodyFatPercent,
    activityLevel: (profile.activityLevel ?? "moderate") as ActivityLevel,
    deficitKcal: profile.deficitKcal ?? DEFAULT_DEFICIT_KCAL,
    /** Always plan inside the evidence range; ignore legacy 2.2 stores. */
    proteinPerKg: DEFAULT_PROTEIN_PER_KG,
    sex: profile.sex,
    allowAnyDeficit: allowAny || profile.suggestedGoalMode != null,
  });
  const range = proteinRangeFromWeight(profile.weightKg);
  const fiber = fiberTargetsFromSex(profile.sex);

  const calorieTarget =
    profile.calorieTargetOverride ??
    profile.suggestedCalorieTarget ??
    computed.calorieTarget;
  const proteinG =
    profile.proteinTargetOverride ??
    profile.suggestedProteinG ??
    computed.proteinG;
  const proteinKcal = proteinG * 4;
  const fatG =
    profile.fatTargetOverride ??
    profile.suggestedFatG ??
    Math.round((calorieTarget * FAT_CALORIE_FRACTION) / 9);
  const carbKcal = Math.max(0, calorieTarget - proteinKcal - fatG * 9);
  const carbsG = Math.round(carbKcal / 4);
  const deficit =
    profile.suggestedDeficitKcal != null &&
    profile.calorieTargetOverride == null
      ? profile.suggestedDeficitKcal
      : computed.tdee - calorieTarget;

  return {
    ...computed,
    deficit,
    calorieTarget,
    proteinG,
    carbsG,
    fatG,
    ...fiber,
    proteinMinG: range.minG,
    proteinGoodG: range.goodG,
    proteinMaxG: range.maxG,
    computedCalorieTarget: computed.calorieTarget,
    computedProteinG: computed.proteinG,
    computedFatG: Math.round(
      (computed.calorieTarget * FAT_CALORIE_FRACTION) / 9,
    ),
    hasOverrides:
      profile.calorieTargetOverride != null ||
      profile.proteinTargetOverride != null ||
      profile.fatTargetOverride != null,
    goalMode: profile.suggestedGoalMode ?? null,
  };
}

/** Prefer frozen plan macros/tdee for date D; else live resolveTargets. */
export function resolveTargetsForDate(
  profile: ProfileForTargets,
  plans: TargetPlanRow[] | null | undefined,
  date: string,
) {
  const plan = planForDate(plans, date);
  if (plan) {
    const fiber = fiberTargetsFromSex(profile.sex);
    const range = profile.weightKg
      ? proteinRangeFromWeight(profile.weightKg)
      : { minG: plan.proteinG, goodG: plan.proteinG, maxG: plan.proteinG };
    /** LBM/BMR are body composition, not frozen on the plan — keep showing live stats. */
    let lbmKg = 0;
    let bmr = 0;
    let bodyFatPercent = profile.bodyFatPercent ?? 0;
    if (
      profile.weightKg &&
      profile.bodyFatPercent != null &&
      Number.isFinite(profile.bodyFatPercent) &&
      profile.bodyFatPercent > 0 &&
      profile.bodyFatPercent < 70
    ) {
      const lbm = leanBodyMassKg(profile.weightKg, profile.bodyFatPercent);
      lbmKg = Math.round(lbm * 10) / 10;
      bmr = Math.round(bmrKatchMcArdle(lbm));
      bodyFatPercent = profile.bodyFatPercent;
    }
    return {
      leanBodyMassKg: lbmKg,
      bodyFatPercent,
      bmr,
      tdee: plan.tdee,
      deficit: plan.deficitKcal,
      calorieTarget: plan.calorieTarget,
      proteinG: plan.proteinG,
      carbsG: plan.carbsG,
      fatG: plan.fatG,
      ...fiber,
      proteinMinG: range.minG,
      proteinGoodG: range.goodG,
      proteinMaxG: range.maxG,
      proteinPerKg: DEFAULT_PROTEIN_PER_KG,
      computedCalorieTarget: plan.calorieTarget,
      computedProteinG: plan.proteinG,
      computedFatG: plan.fatG,
      hasOverrides: true,
      goalMode: plan.goalMode ?? null,
      fromPlan: true as const,
      planEffectiveFrom: plan.effectiveFrom,
    };
  }
  const live = resolveTargets(profile);
  return live ? { ...live, fromPlan: false as const } : null;
}

/**
 * Compendium of Physical Activities — resistance training (MET ≈ 5.5).
 * CaloriesBurned = MET × 3.5 × (WeightKg / 200) × DurationMinutes
 * Insight only — do not subtract from daily calorie target (TDEE covers baseline).
 */
export const RESISTANCE_TRAINING_MET = 5.5;
/** Default jogging / moderate run when no pace is known. */
export const CARDIO_DEFAULT_MET = 8.0;

export function caloriesBurnedResistance(
  weightKg: number,
  durationMinutes: number,
  met = RESISTANCE_TRAINING_MET,
) {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return 0;
  }
  return Math.round(met * 3.5 * (weightKg / 200) * durationMinutes);
}

/** Rough Compendium METs from speed (km/h) for walking/running. */
export function metFromSpeedKmh(kmh: number) {
  if (!Number.isFinite(kmh) || kmh <= 0) return CARDIO_DEFAULT_MET;
  if (kmh < 5) return 3.5;
  if (kmh < 7) return 6.0;
  if (kmh < 8.5) return 8.3;
  if (kmh < 10) return 9.8;
  if (kmh < 11.5) return 11.0;
  if (kmh < 13.5) return 11.8;
  return 14.5;
}

const CARDIO_NAME_RE =
  /\b(run|running|jog|jogging|cycle|cycling|bike|hike|hiking|walk|walking|cardio|swim|swimming|ruck)\b/i;

export function looksLikeCardioSession(name?: string | null) {
  return CARDIO_NAME_RE.test(String(name || ""));
}

/**
 * EEE for a session. Cardio/runs use higher METs; distance+duration
 * refines MET from pace. Gym stays on resistance MET 5.5.
 */
export function caloriesBurnedSession(
  weightKg: number,
  durationMinutes: number,
  opts?: {
    distanceKm?: number | null;
    sessionName?: string | null;
    cardio?: boolean;
  },
) {
  const distance =
    opts?.distanceKm != null && Number.isFinite(opts.distanceKm)
      ? Number(opts.distanceKm)
      : null;
  const cardio =
    opts?.cardio === true || looksLikeCardioSession(opts?.sessionName);

  let met = RESISTANCE_TRAINING_MET;
  if (
    cardio &&
    distance != null &&
    distance > 0 &&
    durationMinutes > 0
  ) {
    const kmh = distance / (durationMinutes / 60);
    met = metFromSpeedKmh(kmh);
  } else if (cardio) {
    met = CARDIO_DEFAULT_MET;
  }

  return caloriesBurnedResistance(weightKg, durationMinutes, met);
}
