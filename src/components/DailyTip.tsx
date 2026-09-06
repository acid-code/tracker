"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { buildNutritionCoach } from "@/lib/nutrition-coach";
import { queryKeys } from "@/lib/query-keys";
import { todayISODate } from "@/lib/tdee";

export type DailyTipPayload = {
  tip: string;
  model: string;
  dismissed?: boolean;
};

type ProfilePayload = {
  userId?: string;
  profile: { weightKg: number | null; bodyFatPercent?: number | null } | null;
  targets: {
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
    tdee: number;
    deficit: number;
    bodyFatPercent?: number;
  } | null;
};

type MacrosPayload = {
  totals: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    calories: number;
  };
};

async function fetchDailyTip({
  client,
}: {
  client: {
    getQueryData: (key: readonly unknown[]) => DailyTipPayload | undefined;
  };
}): Promise<DailyTipPayload> {
  const data = await apiFetch<{ tip: string; model: string }>("/api/coach", {
    method: "POST",
    body: JSON.stringify({ scope: "daily_tip" }),
  });
  const prev = client.getQueryData(queryKeys.dailyTip);
  return {
    tip: data.tip,
    model: data.model,
    dismissed: Boolean(prev?.dismissed),
  };
}

function useDailyTipQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dailyTip,
    queryFn: fetchDailyTip,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 1,
    enabled,
  });
}

function useLocalTip(): string | null {
  const today = todayISODate();
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<ProfilePayload>("/api/profile"),
  });
  const macros = useQuery({
    queryKey: queryKeys.macros(today),
    queryFn: () =>
      apiFetch<MacrosPayload>(
        `/api/macros?date=${encodeURIComponent(today)}`,
      ),
  });

  return useMemo(() => {
    const targets = profile.data?.targets;
    if (!targets) {
      return profile.data?.userId
        ? "Set up your Target so tips can track protein and calories."
        : null;
    }
    const totals = macros.data?.totals ?? {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
    };
    const coach = buildNutritionCoach(
      { ...totals, fiberG: totals.fiberG ?? 0 },
      {
        calorieTarget: targets.calorieTarget,
        proteinG: targets.proteinG,
        proteinMinG: targets.proteinMinG,
        proteinGoodG: targets.proteinGoodG,
        proteinMaxG: targets.proteinMaxG,
        carbsG: targets.carbsG,
        fatG: targets.fatG,
        fiberG: targets.fiberG,
        fiberMinG: targets.fiberMinG,
        fiberMaxG: targets.fiberMaxG,
        tdee: targets.tdee,
        deficit: targets.deficit,
        bodyFatPercent:
          targets.bodyFatPercent ??
          profile.data?.profile?.bodyFatPercent ??
          undefined,
        weightKg: profile.data?.profile?.weightKg,
      },
    );
    const block = coach.improvements[0] ?? coach.why[0];
    if (!block) {
      return "Hit your protein floor and stay near your calorie target today.";
    }
    return (
      block.body.split(/(?<=[.!?])\s+/)[0]?.trim() || block.title
    ).slice(0, 220);
  }, [profile.data, macros.data]);
}

/** Fetches once per app session (QueryClient lifetime). Silent on failure. */
export function DailyTipPrefetch() {
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<ProfilePayload>("/api/profile"),
  });
  useDailyTipQuery(Boolean(profile.data?.userId && profile.data?.targets));
  return null;
}

/** Small tip balloon on Today — local tip immediately, AI upgrades when ready. */
export function DailyTip() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<ProfilePayload>("/api/profile"),
  });
  const localTip = useLocalTip();
  const { data: ai } = useDailyTipQuery(
    Boolean(profile.data?.userId && profile.data?.targets),
  );

  if (ai?.dismissed) return null;
  const tip = ai?.tip || localTip;
  if (!tip) return null;

  return (
    <aside
      className="relative max-w-md ml-0 mr-auto pb-2"
      aria-label="Daily tip"
    >
      <div className="rounded-2xl rounded-bl-md bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-2.5 flex gap-2 items-start shadow-sm">
        <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--foreground)]">
          <span className="text-[var(--accent)] font-medium mr-1.5">Tip</span>
          {tip}
        </p>
        <button
          type="button"
          aria-label="Dismiss tip"
          onClick={() =>
            queryClient.setQueryData<DailyTipPayload>(queryKeys.dailyTip, {
              tip,
              model: ai?.model ?? "local",
              dismissed: true,
            })
          }
          className="shrink-0 text-[var(--muted)] hover:text-[var(--foreground)] h-7 w-7 -mt-0.5 -mr-1 inline-flex items-center justify-center text-base leading-none rounded-full"
        >
          ×
        </button>
      </div>
      <span
        aria-hidden
        className="absolute left-4 -bottom-1.5 w-3 h-3 rotate-45 bg-[var(--surface-2)] border-r border-b border-[var(--border)]"
      />
    </aside>
  );
}
