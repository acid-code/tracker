"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { apiFetch } from "@/lib/api-fetch";
import { GOAL_MODE_LABELS, type GoalMode } from "@/lib/goal-suggest";
import { invalidateAfterProfile } from "@/lib/query-invalidate";
import { queryKeys } from "@/lib/query-keys";
import {
  ACTIVITY_LABELS,
  ACTIVITY_OPTIONS,
  DEFAULT_PROTEIN_PER_KG,
  todayISODate,
  type ActivityLevel,
  type Sex,
} from "@/lib/tdee";

type Targets = {
  bmr: number;
  tdee: number;
  deficit: number;
  calorieTarget: number;
  proteinG: number;
  proteinMinG?: number;
  proteinGoodG?: number;
  proteinMaxG?: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  fiberMinG?: number;
  fiberMaxG?: number;
  leanBodyMassKg?: number;
  bodyFatPercent?: number;
  goalMode?: string | null;
  fromPlan?: boolean;
};

type ProfilePayload = {
  profile?: {
    weightKg?: number | null;
    heightCm?: number | null;
    age?: number | null;
    sex?: Sex | null;
    bodyFatPercent?: number | null;
    activityLevel?: string | null;
    goalTarget?: string | null;
    suggestedGoalMode?: string | null;
    suggestedCalorieTarget?: number | null;
    suggestedProteinG?: number | null;
    suggestedFatG?: number | null;
    suggestedDeficitKcal?: number | null;
    suggestedRationale?: string | null;
    calorieTargetOverride?: number | null;
    proteinTargetOverride?: number | null;
    fatTargetOverride?: number | null;
  } | null;
  targets?: Targets | null;
  suggestionStale?: boolean;
};

export function CalculatorPage() {
  const queryClient = useQueryClient();
  const [weightKg, setWeightKg] = useState("80");
  const [heightCm, setHeightCm] = useState("178");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState<Sex>("male");
  const [bodyFatPercent, setBodyFatPercent] = useState("15");
  const [activityLevel, setActivityLevel] =
    useState<ActivityLevel>("moderate");
  const [goalTarget, setGoalTarget] = useState("");
  const [targets, setTargets] = useState<Targets | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [suggestedMode, setSuggestedMode] = useState<string | null>(null);
  const [suggestionStale, setSuggestionStale] = useState(false);
  const [calEdit, setCalEdit] = useState("");
  const [proEdit, setProEdit] = useState("");
  const [fatEdit, setFatEdit] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<ProfilePayload>("/api/profile"),
  });

  useEffect(() => {
    const data = profileQuery.data;
    if (!data || hydrated) return;
    if (data.profile) {
      if (data.profile.weightKg) setWeightKg(String(data.profile.weightKg));
      if (data.profile.heightCm) setHeightCm(String(data.profile.heightCm));
      if (data.profile.age) setAge(String(data.profile.age));
      if (data.profile.sex) setSex(data.profile.sex);
      if (data.profile.bodyFatPercent != null) {
        setBodyFatPercent(String(data.profile.bodyFatPercent));
      }
      if (data.profile.activityLevel) {
        const a = data.profile.activityLevel as ActivityLevel;
        setActivityLevel(a === "very_active" ? "active" : a);
      }
      if (data.profile.goalTarget) setGoalTarget(data.profile.goalTarget);
      setRationale(data.profile.suggestedRationale ?? null);
      setSuggestedMode(data.profile.suggestedGoalMode ?? null);
      const cal =
        data.profile.calorieTargetOverride ??
        data.profile.suggestedCalorieTarget ??
        data.targets?.calorieTarget;
      const pro =
        data.profile.proteinTargetOverride ??
        data.profile.suggestedProteinG ??
        data.targets?.proteinG;
      const fat =
        data.profile.fatTargetOverride ??
        data.profile.suggestedFatG ??
        data.targets?.fatG;
      if (cal != null) setCalEdit(String(cal));
      if (pro != null) setProEdit(String(pro));
      if (fat != null) setFatEdit(String(fat));
    }
    if (data.targets) setTargets(data.targets);
    setSuggestionStale(!!data.suggestionStale);
    setHydrated(true);
  }, [profileQuery.data, hydrated]);

  function applyPayload(data: ProfilePayload) {
    setTargets(data.targets ?? null);
    setRationale(data.profile?.suggestedRationale ?? null);
    setSuggestedMode(data.profile?.suggestedGoalMode ?? null);
    setSuggestionStale(!!data.suggestionStale);
    const cal =
      data.profile?.calorieTargetOverride ??
      data.profile?.suggestedCalorieTarget ??
      data.targets?.calorieTarget;
    const pro =
      data.profile?.proteinTargetOverride ??
      data.profile?.suggestedProteinG ??
      data.targets?.proteinG;
    const fat =
      data.profile?.fatTargetOverride ??
      data.profile?.suggestedFatG ??
      data.targets?.fatG;
    if (cal != null) setCalEdit(String(cal));
    if (pro != null) setProEdit(String(pro));
    if (fat != null) setFatEdit(String(fat));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const weight = Number(weightKg);
    const height = Number(heightCm);
    const ageN = Number(age);
    const bf = Number(bodyFatPercent);
    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage("Enter a valid weight");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(height) || height <= 0) {
      setMessage("Enter a valid height");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(ageN) || ageN <= 0) {
      setMessage("Enter a valid age");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(bf) || bf < 3 || bf > 60) {
      setMessage("Body fat % must be between 3 and 60");
      setSaving(false);
      return;
    }
    try {
      const data = await apiFetch<ProfilePayload>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          weightKg: weight,
          heightCm: height,
          age: ageN,
          sex,
          bodyFatPercent: bf,
          activityLevel,
          proteinPerKg: DEFAULT_PROTEIN_PER_KG,
          goalTarget: goalTarget.trim() || null,
          date: todayISODate(),
          allowAnyDeficit: true,
        }),
      });
      applyPayload(data);
      setMessage(
        data.targets
          ? "Saved. Suggestion updated from your goal — Apply to start a plan from today."
          : "Saved profile — add body fat % for calorie targets.",
      );
      await invalidateAfterProfile(queryClient);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSuggestion() {
    setSaving(true);
    setMessage("");
    try {
      const data = await apiFetch<ProfilePayload>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          refreshSuggestion: true,
          goalTarget: goalTarget.trim() || null,
          date: todayISODate(),
        }),
      });
      applyPayload(data);
      setMessage("Suggestion refreshed (active plan unchanged until you Apply).");
      await invalidateAfterProfile(queryClient);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestion() {
    setSaving(true);
    setMessage("");
    try {
      const data = await apiFetch<ProfilePayload>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          applyPlan: true,
          useSuggestion: true,
          date: todayISODate(),
        }),
      });
      applyPayload(data);
      setMessage("Applied suggestion from today — earlier days keep prior plans.");
      await invalidateAfterProfile(queryClient);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomPlan() {
    setSaving(true);
    setMessage("");
    const cal = Number(calEdit);
    const pro = Number(proEdit);
    const fat = Number(fatEdit);
    if (!Number.isFinite(cal) || cal <= 0 || !Number.isFinite(pro) || pro <= 0) {
      setMessage("Enter valid calorie and protein targets");
      setSaving(false);
      return;
    }
    try {
      const data = await apiFetch<ProfilePayload>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          applyPlan: true,
          useSuggestion: false,
          calorieTargetOverride: cal,
          proteinTargetOverride: pro,
          fatTargetOverride: Number.isFinite(fat) && fat > 0 ? fat : null,
          date: todayISODate(),
        }),
      });
      applyPayload(data);
      setMessage("Custom targets saved from today.");
      await invalidateAfterProfile(queryClient);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] min-h-[44px]";

  const modeLabel =
    suggestedMode && suggestedMode in GOAL_MODE_LABELS
      ? GOAL_MODE_LABELS[suggestedMode as GoalMode]
      : suggestedMode;

  return (
    <AppShell title="Profile / Calculator">
      <form onSubmit={(e) => void saveProfile(e)} className="space-y-6 max-w-xl">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">Weight (kg)</span>
            <input
              className={field}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">
              Body fat % <span className="text-[var(--accent)]">*</span>
            </span>
            <input
              className={field}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={3}
              max={60}
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">Height (cm)</span>
            <input
              className={field}
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">Age</span>
            <input
              className={field}
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">Sex</span>
            <select
              className={field}
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--muted)]">Activity</span>
            <select
              className={field}
              value={activityLevel}
              onChange={(e) =>
                setActivityLevel(e.target.value as ActivityLevel)
              }
            >
              {ACTIVITY_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-[var(--muted)]">Target</span>
          <textarea
            className={`${field} min-h-[72px] resize-y`}
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder='e.g. "Lose fat while keeping strength" or "Bulk for summer"'
            maxLength={500}
            rows={3}
          />
          <span className="text-[11px] text-[var(--muted)] leading-relaxed block">
            Free text → we suggest cut / recomp / maintain / bulk calories. You
            can always edit the numbers below.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--accent)] text-[var(--background)] px-4 py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]"
          >
            {saving ? "Saving…" : "Save profile & suggest"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void refreshSuggestion()}
            className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm disabled:opacity-60 min-h-[44px]"
          >
            Refresh suggestion
          </button>
        </div>
        {message ? (
          <p className="text-sm text-[var(--muted)]">{message}</p>
        ) : null}
      </form>

      {suggestionStale ? (
        <p className="mt-4 max-w-xl text-sm text-amber-700 dark:text-amber-400">
          Stats changed since this suggestion — refresh suggestion. Your active
          plan still applies until you Apply or save custom targets.
        </p>
      ) : null}

      {rationale || suggestedMode ? (
        <section className="mt-8 max-w-xl space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-medium">
            Suggested
            {modeLabel ? ` · ${modeLabel}` : ""}
          </h2>
          {rationale ? (
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {rationale}
            </p>
          ) : null}
          <p className="text-xs text-[var(--muted)]">
            Saved on your profile so you can always compare. Applying starts a
            new plan from today only.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void applySuggestion()}
            className="rounded-md bg-[var(--accent)] text-[var(--background)] px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Apply suggestion from today
          </button>
        </section>
      ) : null}

      <section className="mt-8 max-w-xl space-y-3">
        <h2 className="text-sm font-medium">Your targets (from today)</h2>
        <p className="text-xs text-[var(--muted)]">
          Sliders apply from today — earlier days keep the previous plan.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-[var(--muted)]">kcal</span>
            <input
              className={field}
              type="number"
              value={calEdit}
              onChange={(e) => setCalEdit(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--muted)]">Protein g</span>
            <input
              className={field}
              type="number"
              value={proEdit}
              onChange={(e) => setProEdit(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--muted)]">Fat g</span>
            <input
              className={field}
              type="number"
              value={fatEdit}
              onChange={(e) => setFatEdit(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveCustomPlan()}
          className="rounded-md border border-[var(--border)] px-4 py-2.5 text-sm disabled:opacity-60 min-h-[44px]"
        >
          Save custom plan from today
        </button>
      </section>

      {targets ? (
        <section className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {[
            ["LBM", `${targets.leanBodyMassKg ?? "—"} kg`],
            ["BMR", `${targets.bmr ? `${targets.bmr} kcal` : "—"}`],
            ["TDEE", `${targets.tdee} kcal`],
            ["Active", `${targets.calorieTarget} kcal`],
            ["Protein", `${targets.proteinG} g`],
            ["Carbs / Fat", `${targets.carbsG}g / ${targets.fatG}g`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider">
                {label}
              </p>
              <p className="text-lg font-medium mt-1">{value}</p>
            </div>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
