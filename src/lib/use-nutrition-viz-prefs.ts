"use client";

import { useEffect, useState } from "react";
import { useProfileUserId } from "@/lib/use-persisted-draft";
import {
  DEFAULT_NUTRITION_VIZ_PREFS,
  NUTRITION_VIZ_CHANGED,
  readNutritionVizPrefs,
  writeNutritionVizPrefs,
  type NutritionVizPrefs,
} from "@/lib/nutrition-viz-prefs";

export function useNutritionVizPrefs() {
  const userId = useProfileUserId();
  const [prefs, setPrefs] = useState<NutritionVizPrefs>(
    DEFAULT_NUTRITION_VIZ_PREFS,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readNutritionVizPrefs(userId));
    setReady(true);
    function onChange(e: Event) {
      const detail = (e as CustomEvent<NutritionVizPrefs>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(readNutritionVizPrefs(userId));
    }
    window.addEventListener(NUTRITION_VIZ_CHANGED, onChange);
    return () => window.removeEventListener(NUTRITION_VIZ_CHANGED, onChange);
  }, [userId]);

  function update(next: Partial<NutritionVizPrefs>) {
    setPrefs((cur) => {
      const merged = { ...cur, ...next };
      writeNutritionVizPrefs(userId, merged);
      return merged;
    });
  }

  return { prefs, update, ready, userId };
}
