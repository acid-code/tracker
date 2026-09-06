"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { MacrosGuesserPanel } from "@/components/MacrosGuesserPanel";
import { MacrosLogPanel } from "@/components/MacrosLogPanel";
import { MenuDailyPanel } from "@/components/MenuPanels";
import { NutritionIdeasAi } from "@/components/NutritionIdeasAi";
import { DayDateBar } from "@/components/DayDateBar";
import {
  NutritionPanelNav,
  nutritionFieldClass,
  type NutritionPanel,
} from "@/components/nutrition-ui";
import { todayISODate } from "@/lib/tdee";

function clampDate(d: string): string {
  const today = todayISODate();
  return d > today ? today : d;
}

function normalizePanel(p: string | null): NutritionPanel {
  if (p === "macros") return "log";
  if (p === "menu" || p === "templates" || p === "log" || p === "guesser") {
    return p;
  }
  return "log";
}

function NutritionContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayISODate();

  const [panel, setPanel] = useState<NutritionPanel>(() =>
    normalizePanel(searchParams.get("panel")),
  );
  const [date, setDate] = useState(() =>
    clampDate(searchParams.get("date") || today),
  );
  const field = nutritionFieldClass();

  useEffect(() => {
    setPanel(normalizePanel(searchParams.get("panel")));
    const nextDate = searchParams.get("date");
    if (nextDate) setDate(clampDate(nextDate));
  }, [searchParams]);

  function syncUrl(nextPanel: NutritionPanel, nextDate: string) {
    const params = new URLSearchParams();
    params.set("panel", nextPanel);
    if (nextDate !== todayISODate()) params.set("date", nextDate);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changePanel(next: NutritionPanel) {
    setPanel(next);
    syncUrl(next, date);
  }

  function changeDate(next: string) {
    const clamped = clampDate(next);
    setDate(clamped);
    syncUrl(panel, clamped);
  }

  return (
    <>
      <DayDateBar
        date={date}
        onChange={changeDate}
        inputClassName={`${field} max-w-[11rem]`}
        className="mb-5"
      />

      <NutritionPanelNav active={panel} onChange={changePanel} />

      {panel === "log" ? <MacrosLogPanel date={date} /> : null}
      {panel === "menu" ? <MenuDailyPanel date={date} /> : null}
      {panel === "templates" ? <NutritionIdeasAi date={date} /> : null}
      {panel === "guesser" ? <MacrosGuesserPanel date={date} /> : null}
    </>
  );
}

export function NutritionPage() {
  return (
    <AppShell title="Nutrition">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--muted)] py-6">Loading…</p>
        }
      >
        <NutritionContent />
      </Suspense>
    </AppShell>
  );
}
