import {
  ACTIVITY_LABELS,
  DEFAULT_PROTEIN_PER_KG,
  type ActivityLevel,
  type Sex,
  calcTargets,
} from "@/lib/tdee";

export type GoalMode = "cut" | "recomp" | "maintain" | "bulk";

/** Planned energy delta vs TDEE (positive = deficit, negative = surplus). */
export const MODE_DEFICIT_KCAL: Record<GoalMode, number> = {
  cut: 500,
  recomp: 400,
  maintain: 0,
  bulk: -300,
};

export const GOAL_MODE_LABELS: Record<GoalMode, string> = {
  cut: "Cut",
  recomp: "Recomp",
  maintain: "Maintain",
  bulk: "Bulk",
};

const CUT_RE =
  /\b(cut|deficit|lose|loss|fat\s*loss|lean\s*out|slim|shred|belly|weight\s*loss|drop)\b/i;
const BULK_RE =
  /\b(bulk|surplus|gain|muscle\s*gain|mass|build|grow|hypertrophy|dirty\s*bulk|lean\s*bulk)\b/i;
const MAINTAIN_RE =
  /\b(maintain|maintenance|tdee|hold|stay|refeed|body\s*recomp\s*hold)\b/i;
const RECOMP_RE =
  /\b(recomp|recomposit|body\s*recomp|slow\s*cut|mini\s*cut)\b/i;

/** Classify free-text goal into a nutrition mode. */
export function classifyGoalMode(goalTarget: string | null | undefined): GoalMode {
  const t = (goalTarget || "").trim();
  if (!t) return "recomp";
  if (BULK_RE.test(t)) return "bulk";
  if (CUT_RE.test(t)) return "cut";
  if (MAINTAIN_RE.test(t)) return "maintain";
  if (RECOMP_RE.test(t)) return "recomp";
  return "recomp";
}

export function buildSuggestionRationale(input: {
  mode: GoalMode;
  tdee: number;
  deficit: number;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  activityLevel: ActivityLevel;
  weightKg: number;
}) {
  const act = ACTIVITY_LABELS[input.activityLevel] ?? input.activityLevel;
  const delta =
    input.deficit > 0
      ? `${input.deficit} kcal below TDEE`
      : input.deficit < 0
        ? `${Math.abs(input.deficit)} kcal above TDEE`
        : "at TDEE (maintenance)";

  switch (input.mode) {
    case "cut":
      return `Cut: ~${input.calorieTarget} kcal (${delta}). Protein ~${input.proteinG}g (~${DEFAULT_PROTEIN_PER_KG} g/kg at ${input.weightKg} kg) to protect muscle; fat ~${input.fatG}g (~25% of calories). Activity: ${act}. TDEE ≈ ${input.tdee}.`;
    case "bulk":
      return `Bulk: ~${input.calorieTarget} kcal (${delta}) for lean gains. Protein ~${input.proteinG}g; fat ~${input.fatG}g. Activity: ${act}. TDEE ≈ ${input.tdee}.`;
    case "maintain":
      return `Maintain: ~${input.calorieTarget} kcal (${delta}). Protein ~${input.proteinG}g; fat ~${input.fatG}g. Activity: ${act}. TDEE ≈ ${input.tdee}.`;
    default:
      return `Recomp: ~${input.calorieTarget} kcal (${delta}) — modest deficit while lifting. Protein ~${input.proteinG}g; fat ~${input.fatG}g. Activity: ${act}. TDEE ≈ ${input.tdee}.`;
  }
}

export function suggestTargetsFromGoal(input: {
  goalTarget: string | null | undefined;
  weightKg: number;
  bodyFatPercent: number;
  activityLevel: ActivityLevel;
  sex?: Sex | null;
  mode?: GoalMode;
}) {
  const mode = input.mode ?? classifyGoalMode(input.goalTarget);
  const deficitKcal = MODE_DEFICIT_KCAL[mode];
  const targets = calcTargets({
    weightKg: input.weightKg,
    bodyFatPercent: input.bodyFatPercent,
    activityLevel: input.activityLevel,
    deficitKcal,
    proteinPerKg: DEFAULT_PROTEIN_PER_KG,
    sex: input.sex,
    allowAnyDeficit: true,
  });
  const rationale = buildSuggestionRationale({
    mode,
    tdee: targets.tdee,
    deficit: targets.deficit,
    calorieTarget: targets.calorieTarget,
    proteinG: targets.proteinG,
    fatG: targets.fatG,
    activityLevel: input.activityLevel,
    weightKg: input.weightKg,
  });
  return {
    mode,
    ...targets,
    rationale,
    basedOnWeightKg: input.weightKg,
    basedOnBodyFatPercent: input.bodyFatPercent,
    basedOnActivityLevel: input.activityLevel,
  };
}

export function suggestionIsStale(input: {
  suggestedBasedOnWeightKg: number | null | undefined;
  suggestedBasedOnBf: number | null | undefined;
  suggestedBasedOnActivity: string | null | undefined;
  weightKg: number | null | undefined;
  bodyFatPercent: number | null | undefined;
  activityLevel: string | null | undefined;
}) {
  if (
    input.suggestedBasedOnWeightKg == null ||
    input.suggestedBasedOnBf == null ||
    !input.suggestedBasedOnActivity
  ) {
    return false;
  }
  if (input.weightKg == null || input.bodyFatPercent == null) return false;
  const wDelta = Math.abs(input.weightKg - input.suggestedBasedOnWeightKg);
  const bfDelta = Math.abs(input.bodyFatPercent - input.suggestedBasedOnBf);
  const actChanged =
    (input.activityLevel ?? "moderate") !== input.suggestedBasedOnActivity;
  return wDelta >= 1 || bfDelta >= 1.5 || actChanged;
}
