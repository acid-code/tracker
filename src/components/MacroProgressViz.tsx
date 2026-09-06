"use client";

import {
  progressRatio,
  proteinBarFillClass,
  proteinBarSegments,
  proteinBarZone,
  proteinRemainingLabel,
  remainingLabel,
  type ProteinBarZone,
} from "@/lib/macros";
import {
  metricOrder,
  type NutritionMetricId,
  type NutritionVizPrefs,
} from "@/lib/nutrition-viz-prefs";

export type MacroVizTotals = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  calories: number;
};

export type MacroVizTargets = {
  proteinG: number;
  proteinMinG?: number;
  proteinGoodG?: number;
  proteinMaxG?: number;
  calorieTarget: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
};

type Props = {
  totals: MacroVizTotals;
  targets: MacroVizTargets;
  prefs: NutritionVizPrefs;
  proteinToneClass?: string;
  proteinNoteLabel?: string | null;
  calWarned?: boolean;
  fatWarned?: boolean;
  carbWarned?: boolean;
};

type MetricSpec = {
  id: NutritionMetricId;
  label: string;
  current: number;
  target: number;
  unit: string;
  ratio: number;
  color: string;
  overColor: string;
  warned?: boolean;
  detail?: string | null;
};

function cssVar(name: string) {
  return `var(${name})`;
}

function metricColor(id: NutritionMetricId, zone?: ProteinBarZone) {
  if (id === "protein") {
    if (zone === "low") return cssVar("--nv-protein-low");
    if (zone === "soft") return cssVar("--nv-protein-soft");
    if (zone === "hard") return cssVar("--nv-protein");
    if (zone === "max") return cssVar("--nv-protein-max");
    if (zone === "over") return cssVar("--nv-over");
    return cssVar("--nv-protein");
  }
  if (id === "calories") return cssVar("--nv-calories");
  if (id === "fat") return cssVar("--nv-fat");
  return cssVar("--nv-fiber");
}

function buildMetrics(
  totals: MacroVizTotals,
  targets: MacroVizTargets,
  prefs: NutritionVizPrefs,
  opts: { calWarned?: boolean; fatWarned?: boolean },
): MetricSpec[] {
  const proteinMin = targets.proteinMinG ?? targets.proteinG;
  const proteinGood = targets.proteinGoodG ?? proteinMin;
  const proteinMax = targets.proteinMaxG ?? targets.proteinG;
  const zone = proteinBarZone(
    totals.proteinG,
    proteinMin,
    proteinGood,
    proteinMax,
  );
  const proteinTarget = proteinMax > 0 ? proteinMax : targets.proteinG;
  const proteinRatio =
    proteinTarget > 0 ? Math.min(totals.proteinG / proteinTarget, 2) : 0;

  const all: Record<NutritionMetricId, MetricSpec> = {
    protein: {
      id: "protein",
      label: "Protein",
      current: totals.proteinG,
      target: proteinTarget,
      unit: "g",
      ratio: proteinRatio,
      color: metricColor("protein", zone === "over" ? "hard" : zone),
      overColor: cssVar("--nv-over"),
      detail: proteinRemainingLabel(totals.proteinG, proteinMin, proteinMax),
    },
    calories: {
      id: "calories",
      label: "Calories",
      current: totals.calories,
      target: targets.calorieTarget,
      unit: "",
      ratio:
        targets.calorieTarget > 0
          ? totals.calories / targets.calorieTarget
          : 0,
      color: opts.calWarned
        ? cssVar("--nv-over")
        : metricColor("calories"),
      overColor: cssVar("--nv-over"),
      warned: opts.calWarned,
      detail: remainingLabel(totals.calories, targets.calorieTarget, " kcal"),
    },
    fat: {
      id: "fat",
      label: "Fat",
      current: totals.fatG,
      target: targets.fatG,
      unit: "g",
      ratio: targets.fatG > 0 ? totals.fatG / targets.fatG : 0,
      color: opts.fatWarned ? cssVar("--nv-over") : metricColor("fat"),
      overColor: cssVar("--nv-over"),
      warned: opts.fatWarned,
      detail: remainingLabel(totals.fatG, targets.fatG, "g"),
    },
    fiber: {
      id: "fiber",
      label: "Fiber",
      current: totals.fiberG ?? 0,
      target: targets.fiberG,
      unit: "g",
      ratio: targets.fiberG > 0 ? (totals.fiberG ?? 0) / targets.fiberG : 0,
      color: metricColor("fiber"),
      overColor: cssVar("--nv-over"),
      detail: remainingLabel(totals.fiberG ?? 0, targets.fiberG, "g"),
    },
  };

  return metricOrder(prefs.priority)
    .map((id) => all[id])
    .filter((m) => m.target > 0);
}

function formatCurrent(m: MetricSpec) {
  return `${Math.round(m.current)}${m.unit}`;
}

function formatTarget(m: MetricSpec) {
  return `${Math.round(m.target)}${m.unit}`;
}

/** SVG ring: full arc + darker override when past 100%. */
function RingArc({
  cx,
  r,
  ratio,
  color,
  overColor,
  width = 10,
}: {
  cx: number;
  r: number;
  ratio: number;
  color: string;
  overColor: string;
  width?: number;
}) {
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.max(ratio, 0), 1);
  const over = Math.min(Math.max(ratio - 1, 0), 1);
  return (
    <g transform={`rotate(-90 ${cx} ${cx})`}>
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--nv-track)"
        strokeWidth={width}
      />
      {filled > 0 ? (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={`${filled * c} ${c}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      ) : null}
      {over > 0 ? (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={overColor}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={`${over * c} ${c}`}
          className="transition-[stroke-dasharray] duration-500"
          opacity={0.95}
        />
      ) : null}
    </g>
  );
}

function BarsLayout({
  metrics,
  totals,
  targets,
  proteinToneClass,
  proteinNoteLabel,
  calWarned,
  carbWarned,
  fatWarned,
}: {
  metrics: MetricSpec[];
  totals: MacroVizTotals;
  targets: MacroVizTargets;
  proteinToneClass?: string;
  proteinNoteLabel?: string | null;
  calWarned?: boolean;
  carbWarned?: boolean;
  fatWarned?: boolean;
}) {
  const proteinMin = targets.proteinMinG ?? targets.proteinG;
  const proteinGood = targets.proteinGoodG ?? proteinMin;
  const proteinMax = targets.proteinMaxG ?? targets.proteinG;
  const proteinSegments = proteinBarSegments(
    totals.proteinG,
    proteinMin,
    proteinGood,
    proteinMax,
  );
  const lead = metrics[0];
  const second = metrics[1];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[lead, second].filter(Boolean).map((m) => (
          <div key={m!.id}>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
              {m!.label}
            </p>
            <p
              className={`text-2xl sm:text-3xl font-semibold ${
                m!.warned ? "text-[var(--warn)]" : ""
              }`}
            >
              {Math.round(m!.current)}
              {m!.unit ? (
                <span className="text-base text-[var(--muted)] font-normal">
                  {m!.unit}
                </span>
              ) : null}
            </p>
            <p
              className={`text-xs ${
                m!.warned
                  ? "text-[var(--warn)]"
                  : m!.id === "protein"
                    ? "text-[var(--accent)]"
                    : "text-[var(--accent)]"
              }`}
            >
              {m!.detail}
            </p>
            {m!.id === "protein" && proteinNoteLabel ? (
              <p className={`text-xs mt-0.5 ${proteinToneClass ?? ""}`}>
                {proteinNoteLabel}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {metrics.map((m) => {
          if (m.id === "protein") {
            return (
              <div key={m.id}>
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                  <span>Protein · 1.61–2.2 g/kg</span>
                  <span className={proteinToneClass || undefined}>
                    {Math.round(totals.proteinG)}g
                    {proteinMin > 0
                      ? ` · floor ${proteinMin} · max ${proteinMax}`
                      : ""}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-[var(--nv-track)] overflow-hidden">
                  {proteinSegments.map((seg) => (
                    <div
                      key={seg.key}
                      className={`absolute top-0 bottom-0 transition-all duration-500 ${proteinBarFillClass(seg.key)}`}
                      style={{
                        left: `${seg.leftPct}%`,
                        width: `${seg.widthPct}%`,
                      }}
                    />
                  ))}
                  {proteinMax > 0 ? (
                    <>
                      <span
                        className="absolute top-0 bottom-0 w-px bg-white/25"
                        style={{
                          left: `${(proteinMin / proteinMax) * 100}%`,
                        }}
                        title="1.61 g/kg floor"
                      />
                      <span
                        className="absolute top-0 bottom-0 w-px bg-white/40"
                        style={{
                          left: `${(proteinGood / proteinMax) * 100}%`,
                        }}
                        title="1.85 g/kg strong zone"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id}>
              <div className="flex justify-between text-xs mb-1">
                <span
                  className={
                    m.warned ? "text-[var(--warn)]" : "text-[var(--muted)]"
                  }
                >
                  {m.label}
                  {m.warned ? " — over" : ""}
                </span>
                <span
                  className={
                    m.warned ? "text-[var(--warn)]" : "text-[var(--muted)]"
                  }
                >
                  {formatCurrent(m)}/{formatTarget(m)}
                  {m.id !== "calories" && m.detail && !m.warned
                    ? ` · ${m.detail}`
                    : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--nv-track)] overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, progressRatio(m.current, m.target) * 100)}%`,
                    background: m.warned ? "var(--nv-over)" : m.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <MacroFooter
        totals={totals}
        targets={targets}
        carbWarned={carbWarned}
        fatWarned={fatWarned}
      />
    </>
  );
}

function RingsLayout({
  metrics,
  totals,
  targets,
  carbWarned,
  fatWarned,
}: {
  metrics: MetricSpec[];
  totals: MacroVizTotals;
  targets: MacroVizTargets;
  carbWarned?: boolean;
  fatWarned?: boolean;
}) {
  const size = 220;
  const cx = size / 2;
  const ringCount = metrics.length;
  const gap = 15;
  const outerR = 96;
  const strokeW = 10;
  const lead = metrics[0];
  const innerR = outerR - Math.max(ringCount - 1, 0) * gap;
  const clearR = innerR - strokeW / 2;
  const centerPad = Math.max(size / 2 - clearR + 12, 44);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {metrics.map((m, i) => {
              const r = outerR - i * gap;
              return (
                <RingArc
                  key={m.id}
                  cx={cx}
                  r={r}
                  ratio={m.ratio}
                  color={m.color}
                  overColor={m.overColor}
                  width={strokeW}
                />
              );
            })}
          </svg>
          {lead ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
              style={{ padding: centerPad }}
            >
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                {lead.label}
              </p>
              <p className="text-xl font-semibold leading-tight">
                {Math.round(lead.current)}
                <span className="text-sm text-[var(--muted)] font-normal">
                  {lead.unit || ""}
                </span>
              </p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">
                / {formatTarget(lead)}
              </p>
            </div>
          ) : null}
        </div>
        <ul className="w-full space-y-2.5 min-w-0">
          {metrics.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2.5 text-sm">
              <span
                className="size-2.5 rounded-full shrink-0 ring-2 ring-[var(--nv-track)]"
                style={{ background: m.color }}
                title={i === 0 ? "Outer ring" : undefined}
              />
              <div className="flex-1 min-w-0 flex justify-between gap-2">
                <span className={m.warned ? "text-[var(--warn)]" : ""}>
                  {m.label}
                  {i === 0 ? (
                    <span className="text-[10px] text-[var(--muted)] ml-1.5">
                      outer
                    </span>
                  ) : null}
                </span>
                <span
                  className={`tabular-nums shrink-0 ${
                    m.warned ? "text-[var(--warn)]" : "text-[var(--muted)]"
                  }`}
                >
                  {formatCurrent(m)}/{formatTarget(m)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {ringCount > 0 ? (
        <p className="text-[10px] text-[var(--muted)]">
          Past target darkens the start of that ring.
        </p>
      ) : null}
      <MacroFooter
        totals={totals}
        targets={targets}
        carbWarned={carbWarned}
        fatWarned={fatWarned}
      />
    </>
  );
}

function TilesLayout({
  metrics,
  totals,
  targets,
  carbWarned,
  fatWarned,
}: {
  metrics: MetricSpec[];
  totals: MacroVizTotals;
  targets: MacroVizTargets;
  carbWarned?: boolean;
  fatWarned?: boolean;
}) {
  const tile = 96;
  const cx = tile / 2;
  const r = 34;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div
            key={m.id}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-[var(--surface-2)]/60 py-3 px-2"
          >
            <div className="relative" style={{ width: tile, height: tile }}>
              <svg width={tile} height={tile} viewBox={`0 0 ${tile} ${tile}`}>
                <RingArc
                  cx={cx}
                  r={r}
                  ratio={m.ratio}
                  color={m.color}
                  overColor={m.overColor}
                  width={9}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    m.warned ? "text-[var(--warn)]" : ""
                  }`}
                >
                  {Math.round(m.current)}
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)]">{m.label}</p>
            <p
              className={`text-[10px] tabular-nums ${
                m.warned ? "text-[var(--warn)]" : "text-[var(--muted)]"
              }`}
            >
              / {formatTarget(m)}
            </p>
          </div>
        ))}
      </div>
      <MacroFooter
        totals={totals}
        targets={targets}
        carbWarned={carbWarned}
        fatWarned={fatWarned}
      />
    </>
  );
}

function MacroFooter({
  totals,
  targets,
  carbWarned,
  fatWarned,
}: {
  totals: MacroVizTotals;
  targets: MacroVizTargets;
  carbWarned?: boolean;
  fatWarned?: boolean;
}) {
  return (
    <p className="text-xs text-[var(--muted)]">
      Carbs{" "}
      <span className={carbWarned ? "text-[var(--warn)]" : undefined}>
        {Math.round(totals.carbsG)}g / {targets.carbsG}g
      </span>
      {" · "}
      Fat{" "}
      <span
        className={fatWarned ? "text-[var(--warn)] font-medium" : undefined}
      >
        {Math.round(totals.fatG)}g / {targets.fatG}g
        {fatWarned ? " over" : ""}
      </span>
      {" · "}
      Fiber{" "}
      <span>
        {Math.round(totals.fiberG ?? 0)}g
        {targets.fiberG ? ` / ${targets.fiberG}g` : ""}
      </span>
    </p>
  );
}

export function MacroProgressViz({
  totals,
  targets,
  prefs,
  proteinToneClass,
  proteinNoteLabel,
  calWarned,
  fatWarned,
  carbWarned,
}: Props) {
  const metrics = buildMetrics(totals, targets, prefs, {
    calWarned,
    fatWarned,
  });
  const palette = prefs.palette;

  return (
    <div
      data-nutrition-palette={palette}
      className="nutrition-viz space-y-4"
    >
      {prefs.layout === "rings" ? (
        <RingsLayout
          metrics={metrics}
          totals={totals}
          targets={targets}
          carbWarned={carbWarned}
          fatWarned={fatWarned}
        />
      ) : prefs.layout === "tiles" ? (
        <TilesLayout
          metrics={metrics}
          totals={totals}
          targets={targets}
          carbWarned={carbWarned}
          fatWarned={fatWarned}
        />
      ) : (
        <BarsLayout
          metrics={metrics}
          totals={totals}
          targets={targets}
          proteinToneClass={proteinToneClass}
          proteinNoteLabel={proteinNoteLabel}
          calWarned={calWarned}
          carbWarned={carbWarned}
          fatWarned={fatWarned}
        />
      )}
    </div>
  );
}
