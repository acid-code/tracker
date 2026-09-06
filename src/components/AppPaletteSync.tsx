"use client";

import { useEffect } from "react";
import { useNutritionVizPrefs } from "@/lib/use-nutrition-viz-prefs";

/** Applies the Settings color scheme to the whole app (html[data-app-palette]). */
export function AppPaletteSync() {
  const { prefs, ready } = useNutritionVizPrefs();

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.appPalette = prefs.palette;
  }, [prefs.palette, ready]);

  return null;
}
