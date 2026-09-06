"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartAxis,
  chartBarFill,
  chartCursorFill,
  chartGrid,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "@/lib/chart-theme";

export function EeeBurnChart({
  data,
}: {
  data: Array<{
    date: string;
    caloriesBurned: number;
    durationMinutes?: number;
  }>;
}) {
  const rows = data.filter((d) => d.caloriesBurned > 0);

  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--muted)] py-10 text-center">
        No workout burn logged yet. Add session duration on Exercises to track
        EEE.
      </p>
    );
  }

  return (
    <div className="h-56 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="18%"
          accessibilityLayer={false}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} {...chartGrid} />
          <XAxis
            dataKey="date"
            tick={chartAxis}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis tick={chartAxis} width={40} />
          <Tooltip
            cursor={{ fill: chartCursorFill }}
            contentStyle={chartTooltipStyle}
            labelStyle={chartTooltipLabelStyle}
            itemStyle={chartTooltipItemStyle}
            formatter={(value) => [`${value} kcal`, "EEE burn"]}
            labelFormatter={(label) => label}
          />
          <Bar
            dataKey="caloriesBurned"
            fill={chartBarFill}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            name="EEE (kcal)"
            activeBar={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
