"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartAccent,
  chartAxis,
  chartCursorStroke,
  chartDimLine,
  chartGrid,
  chartProtein,
  chartTooltipStyle,
} from "@/lib/chart-theme";

export function NutritionChart({
  data,
  proteinTarget,
}: {
  data: Array<{ date: string; proteinG: number; calories: number }>;
  proteinTarget?: number | null;
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-[var(--muted)] py-10 text-center">
        No nutrition logs in this range.
      </p>
    );
  }

  const withTarget = data.map((d) => ({
    ...d,
    proteinTarget: proteinTarget ?? undefined,
  }));

  return (
    <div className="h-56 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={withTarget}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          accessibilityLayer={false}
        >
          <CartesianGrid strokeDasharray="3 3" {...chartGrid} />
          <XAxis
            dataKey="date"
            tick={chartAxis}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis yAxisId="p" tick={chartAxis} width={36} />
          <YAxis yAxisId="c" orientation="right" tick={chartAxis} width={40} />
          <Tooltip
            cursor={{ stroke: chartCursorStroke, strokeWidth: 1 }}
            contentStyle={chartTooltipStyle}
          />
          <Legend />
          <Line
            yAxisId="p"
            type="monotone"
            dataKey="proteinG"
            stroke={chartProtein}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            name="Protein (g)"
          />
          {proteinTarget ? (
            <Line
              yAxisId="p"
              type="monotone"
              dataKey="proteinTarget"
              stroke={chartDimLine}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              name="Protein floor"
            />
          ) : null}
          <Line
            yAxisId="c"
            type="monotone"
            dataKey="calories"
            stroke={chartAccent}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            name="Calories"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
