"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { invalidateAfterProfile } from "@/lib/query-invalidate";
import { queryKeys } from "@/lib/query-keys";
import { todayISODate } from "@/lib/tdee";

type Targets = {
  calorieTarget: number;
  proteinG: number;
  fatG?: number;
  computedCalorieTarget?: number;
  computedProteinG?: number;
  hasOverrides?: boolean;
};

type ProfilePayload = {
  profile?: {
    calorieTargetOverride?: number | null;
    proteinTargetOverride?: number | null;
    fatTargetOverride?: number | null;
    suggestedCalorieTarget?: number | null;
    suggestedProteinG?: number | null;
    suggestedFatG?: number | null;
    suggestedRationale?: string | null;
    suggestedGoalMode?: string | null;
  } | null;
  targets?: Targets | null;
  suggestionStale?: boolean;
};

export function SettingsNutrition() {
  const queryClient = useQueryClient();
  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");
  const [fatTarget, setFatTarget] = useState("");
  const [useSuggestion, setUseSuggestion] = useState(true);
  const [computed, setComputed] = useState<Targets | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<ProfilePayload>("/api/profile"),
  });

  useEffect(() => {
    const d = profileQuery.data;
    if (!d || hydrated) return;
    if (d.targets) setComputed(d.targets);
    setRationale(d.profile?.suggestedRationale ?? null);
    const hasOverrides =
      d.profile?.calorieTargetOverride != null ||
      d.profile?.proteinTargetOverride != null ||
      d.profile?.fatTargetOverride != null;
    setUseSuggestion(!hasOverrides);
    setCalorieTarget(
      String(
        d.profile?.calorieTargetOverride ??
          d.targets?.calorieTarget ??
          d.profile?.suggestedCalorieTarget ??
          "",
      ),
    );
    setProteinTarget(
      String(
        d.profile?.proteinTargetOverride ??
          d.targets?.proteinG ??
          d.profile?.suggestedProteinG ??
          "",
      ),
    );
    setFatTarget(
      String(
        d.profile?.fatTargetOverride ??
          d.targets?.fatG ??
          d.profile?.suggestedFatG ??
          "",
      ),
    );
    setHydrated(true);
  }, [profileQuery.data, hydrated]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const data = await apiFetch<ProfilePayload>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(
          useSuggestion
            ? {
                applyPlan: true,
                useSuggestion: true,
                date: todayISODate(),
              }
            : {
                applyPlan: true,
                useSuggestion: false,
                calorieTargetOverride: Number(calorieTarget),
                proteinTargetOverride: Number(proteinTarget),
                fatTargetOverride:
                  fatTarget.trim() === "" ? null : Number(fatTarget),
                date: todayISODate(),
              },
        ),
      });
      setComputed(data.targets ?? null);
      setRationale(data.profile?.suggestedRationale ?? null);
      setMessage(
        "Nutrition plan saved from today — earlier days keep prior plans.",
      );
      await invalidateAfterProfile(queryClient);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <section className="space-y-4 pt-4 border-t border-[var(--border)]">
      <div>
        <h2 className="text-sm font-medium">Nutrition targets</h2>
        <p className="text-xs text-[var(--muted)] mt-1">
          Changes apply from today only. Full calculator + goal text:{" "}
          <Link href="/calculator" className="underline">
            Profile / Calculator
          </Link>
          .
        </p>
      </div>

      {rationale ? (
        <p className="text-xs text-[var(--muted)] leading-relaxed">{rationale}</p>
      ) : null}
      {profileQuery.data?.suggestionStale ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Body stats changed since the saved suggestion — refresh on Calculator.
        </p>
      ) : null}

      {computed?.computedCalorieTarget != null ? (
        <p className="text-xs text-[var(--muted)]">
          Formula baseline ~{computed.computedCalorieTarget} kcal /{" "}
          {computed.computedProteinG}g protein.
        </p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useSuggestion}
            onChange={(e) => setUseSuggestion(e.target.checked)}
          />
          Use saved suggestion / calculator plan
        </label>
        {!useSuggestion ? (
          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-xs text-[var(--muted)]">kcal</span>
              <input
                className={field}
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[var(--muted)]">Protein</span>
              <input
                className={field}
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[var(--muted)]">Fat</span>
              <input
                className={field}
                type="number"
                value={fatTarget}
                onChange={(e) => setFatTarget(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[var(--accent)] text-[var(--background)] px-3 py-2 text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save plan from today"}
        </button>
        {message ? (
          <p className="text-xs text-[var(--muted)]">{message}</p>
        ) : null}
      </form>
    </section>
  );
}
