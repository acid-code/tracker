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
import { SLEEP_HOURS_MAX, SLEEP_HOURS_MIN } from "@/lib/sleep";
import {
  chartAccent,
  chartAxis,
  chartCursorStroke,
  chartGrid,
  chartTooltipStyle,
} from "@/lib/chart-theme";

export function SleepChart({
  data,
}: {
  data: Array<{ date: string; hours: number; quality: number }>;
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-[var(--muted)] py-10 text-center">
        No sleep entries yet.
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
          <YAxis
            tick={chartAxis}
            domain={[
              Math.min(SLEEP_HOURS_MIN - 1, ...data.map((d) => d.hours)) - 0.5,
              Math.max(SLEEP_HOURS_MAX + 1, ...data.map((d) => d.hours)) + 0.5,
            ]}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: chartCursorStroke, strokeWidth: 1 }}
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => {
              if (name === "hours") return [`${value}h`, "Hours"];
              return [value, "Quality"];
            }}
          />
          <Line
            type="monotone"
            dataKey="hours"
            stroke={chartAccent}
            strokeWidth={2}
            dot={{ r: 3, fill: chartAccent }}
            activeDot={false}
            name="hours"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
