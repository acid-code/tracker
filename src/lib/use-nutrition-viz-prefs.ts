"use client";

import { useEffect, useState } from "react";
import { useProfileUserId } from "@/lib/use-persisted-draft";
import {
  findUserIdForStorageBase,
  readLastUserId,
} from "@/lib/user-storage";
import {
  DEFAULT_NUTRITION_VIZ_PREFS,
  NUTRITION_VIZ_CHANGED,
  NUTRITION_VIZ_STORAGE,
  readNutritionVizPrefs,
  writeNutritionVizPrefs,
  type NutritionVizPrefs,
} from "@/lib/nutrition-viz-prefs";

function storageUserId(userId: string | null) {
  return (
    userId ??
    readLastUserId() ??
    findUserIdForStorageBase(NUTRITION_VIZ_STORAGE)
  );
}

export function useNutritionVizPrefs() {
  const userId = useProfileUserId();
  const [prefs, setPrefs] = useState<NutritionVizPrefs>(
    DEFAULT_NUTRITION_VIZ_PREFS,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = storageUserId(userId);
    setPrefs(readNutritionVizPrefs(id));
    setReady(true);
    function onChange(e: Event) {
      const detail = (e as CustomEvent<NutritionVizPrefs>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(readNutritionVizPrefs(id));
    }
    window.addEventListener(NUTRITION_VIZ_CHANGED, onChange);
    return () => window.removeEventListener(NUTRITION_VIZ_CHANGED, onChange);
  }, [userId]);

  function update(next: Partial<NutritionVizPrefs>) {
    setPrefs((cur) => {
      const merged = { ...cur, ...next };
      writeNutritionVizPrefs(storageUserId(userId), merged);
      return merged;
    });
  }

  return { prefs, update, ready, userId };
}
