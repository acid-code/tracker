import {
  readUserStorageItem,
  writeUserStorageItem,
} from "@/lib/user-storage";

export const NUTRITION_VIZ_STORAGE = "recomp.nutrition-viz";
export const NUTRITION_VIZ_CHANGED = "recomp:nutrition-viz-changed";

export type NutritionVizLayout = "bars" | "rings" | "tiles";
export type NutritionVizPalette =
  | "classic"
  | "ember"
  | "daylight"
  | "fog";
export type NutritionVizPriority = "protein" | "calories" | "balanced";
export type NutritionMetricId = "protein" | "calories" | "fat" | "fiber";

export type NutritionVizPrefs = {
  layout: NutritionVizLayout;
  palette: NutritionVizPalette;
  priority: NutritionVizPriority;
};

export const DEFAULT_NUTRITION_VIZ_PREFS: NutritionVizPrefs = {
  layout: "bars",
  palette: "classic",
  priority: "protein",
};

export const NUTRITION_VIZ_LAYOUTS: Array<{
  id: NutritionVizLayout;
  label: string;
  hint: string;
}> = [
  { id: "bars", label: "Bars", hint: "Classic stacked progress rows" },
  { id: "rings", label: "Rings", hint: "Concentric circles by priority" },
  { id: "tiles", label: "Tiles", hint: "One ring per macro in a grid" },
];

export const NUTRITION_VIZ_PALETTES: Array<{
  id: NutritionVizPalette;
  label: string;
  hint: string;
}> = [
  { id: "classic", label: "Classic", hint: "Original dark mint" },
  { id: "ember", label: "Ember", hint: "Warm dark evening" },
  { id: "daylight", label: "Daylight", hint: "Light mint" },
  { id: "fog", label: "Fog", hint: "Light cool slate" },
];

export const NUTRITION_VIZ_PRIORITIES: Array<{
  id: NutritionVizPriority;
  label: string;
  hint: string;
}> = [
  { id: "protein", label: "Protein first", hint: "Protein outermost / top" },
  { id: "calories", label: "Calories first", hint: "Calories outermost / top" },
  { id: "balanced", label: "Balanced", hint: "Protein & calories co-lead" },
];

const METRIC_ORDERS: Record<NutritionVizPriority, NutritionMetricId[]> = {
  protein: ["protein", "calories", "fat", "fiber"],
  calories: ["calories", "protein", "fat", "fiber"],
  balanced: ["protein", "calories", "fiber", "fat"],
};

export function metricOrder(
  priority: NutritionVizPriority,
): NutritionMetricId[] {
  return METRIC_ORDERS[priority];
}

function migratePalette(raw: unknown): NutritionVizPalette {
  if (raw === "classic" || raw === "ember" || raw === "daylight" || raw === "fog") {
    return raw;
  }
  // Legacy ids from earlier dark-only set
  if (raw === "mint") return "classic";
  if (raw === "sunset") return "ember";
  if (raw === "ocean") return "classic";
  if (raw === "mono") return "fog";
  return DEFAULT_NUTRITION_VIZ_PREFS.palette;
}

function parsePrefs(raw: string | null): NutritionVizPrefs {
  if (!raw) return { ...DEFAULT_NUTRITION_VIZ_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<NutritionVizPrefs>;
    return {
      layout:
        parsed.layout === "bars" ||
        parsed.layout === "rings" ||
        parsed.layout === "tiles"
          ? parsed.layout
          : DEFAULT_NUTRITION_VIZ_PREFS.layout,
      palette: migratePalette(parsed.palette),
      priority:
        parsed.priority === "protein" ||
        parsed.priority === "calories" ||
        parsed.priority === "balanced"
          ? parsed.priority
          : DEFAULT_NUTRITION_VIZ_PREFS.priority,
    };
  } catch {
    return { ...DEFAULT_NUTRITION_VIZ_PREFS };
  }
}

export function readNutritionVizPrefs(
  userId: string | null | undefined,
): NutritionVizPrefs {
  return parsePrefs(readUserStorageItem(NUTRITION_VIZ_STORAGE, userId));
}

export function writeNutritionVizPrefs(
  userId: string | null | undefined,
  prefs: NutritionVizPrefs,
) {
  writeUserStorageItem(NUTRITION_VIZ_STORAGE, userId, JSON.stringify(prefs));
  if (typeof window !== "undefined") {
    // Defer so listeners don't setState while another component is rendering.
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent(NUTRITION_VIZ_CHANGED, { detail: prefs }),
      );
    });
  }
}
