/** Shared Recharts colors — follow app palette via CSS variables. */
export const chartAxis = { stroke: "var(--muted)", fontSize: 11 } as const;
export const chartGrid = { stroke: "var(--border)" } as const;

export const chartAccent = "var(--accent)";
export const chartProtein = "var(--protein-hard)";
export const chartMutedLine = "var(--muted)";
export const chartDimLine = "color-mix(in srgb, var(--muted) 70%, #000)";

export const chartCursorStroke =
  "color-mix(in srgb, var(--accent) 35%, transparent)";
export const chartCursorFill =
  "color-mix(in srgb, var(--accent) 12%, transparent)";
export const chartBarFill =
  "color-mix(in srgb, var(--accent) 72%, transparent)";
export const chartBarMuted =
  "color-mix(in srgb, var(--accent) 42%, transparent)";

export const chartTooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
} as const;

export const chartTooltipLabelStyle = { color: "var(--muted)" } as const;
export const chartTooltipItemStyle = { color: "var(--foreground)" } as const;
