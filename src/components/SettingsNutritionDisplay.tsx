"use client";

import {
  NUTRITION_VIZ_LAYOUTS,
  NUTRITION_VIZ_PALETTES,
  NUTRITION_VIZ_PRIORITIES,
} from "@/lib/nutrition-viz-prefs";
import { useNutritionVizPrefs } from "@/lib/use-nutrition-viz-prefs";

function ChoiceRow({
  label,
  hint,
  selected,
  onSelect,
  swatch,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
  swatch?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] hover:border-[var(--muted)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {swatch ? (
          <span className="flex gap-1 shrink-0">
            {swatch.map((c) => (
              <span
                key={c}
                className="size-3 rounded-full"
                style={{ background: c }}
              />
            ))}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="text-xs text-[var(--muted)] mt-0.5">{hint}</p>
      ) : null}
    </button>
  );
}

const PALETTE_SWATCHES: Record<string, string[]> = {
  classic: ["#5bc4ae", "#7dd3c0", "#5b9fd4"],
  ember: ["#d4896a", "#e07a5f", "#c4a574"],
  daylight: ["#2a9d8f", "#3cb4a0", "#3d7ea6"],
  fog: ["#4a7c9b", "#5a9ab0", "#6b8cae"],
};

export function SettingsNutritionDisplay() {
  const { prefs, update, ready } = useNutritionVizPrefs();

  if (!ready) {
    return (
      <section className="space-y-4 pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted)]">Loading display options…</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 pt-4 border-t border-[var(--border)]">
      <div>
        <h2 className="text-sm font-medium">Display</h2>
        <p className="text-xs text-[var(--muted)] mt-1">
          Color scheme applies to the whole app. Layout and priority are for the
          nutrition log — macro bars keep their own distinct colors.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Layout
        </p>
        <div className="space-y-2">
          {NUTRITION_VIZ_LAYOUTS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              label={opt.label}
              hint={opt.hint}
              selected={prefs.layout === opt.id}
              onSelect={() => update({ layout: opt.id })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Color scheme (app-wide)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {NUTRITION_VIZ_PALETTES.map((opt) => (
            <ChoiceRow
              key={opt.id}
              label={opt.label}
              hint={opt.hint}
              selected={prefs.palette === opt.id}
              onSelect={() => update({ palette: opt.id })}
              swatch={PALETTE_SWATCHES[opt.id]}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Priority
        </p>
        <div className="space-y-2">
          {NUTRITION_VIZ_PRIORITIES.map((opt) => (
            <ChoiceRow
              key={opt.id}
              label={opt.label}
              hint={opt.hint}
              selected={prefs.priority === opt.id}
              onSelect={() => update({ priority: opt.id })}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
