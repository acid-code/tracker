"use client";

import {
  CartesianGrid,
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
  chartGrid,
  chartMutedLine,
  chartTooltipStyle,
} from "@/lib/chart-theme";

export function LiftProgressChart({
  data,
}: {
  data: Array<{
    date: string;
    bestWeight: number;
    volume: number;
  }>;
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-[var(--muted)] py-10 text-center">
        No lift data for this selection.
      </p>
    );
  }

  return (
    <div className="h-56 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          accessibilityLayer={false}
        >
          <CartesianGrid strokeDasharray="3 3" {...chartGrid} />
          <XAxis
            dataKey="date"
            tick={chartAxis}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={chartAxis} width={40} />
          <Tooltip
            cursor={{ stroke: chartCursorStroke, strokeWidth: 1 }}
            contentStyle={chartTooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="bestWeight"
            stroke={chartAccent}
            strokeWidth={2}
            dot={{ r: 3, fill: chartAccent }}
            activeDot={false}
            name="Best set (kg)"
          />
          <Line
            type="monotone"
            dataKey="volume"
            stroke={chartMutedLine}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            name="Volume"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
