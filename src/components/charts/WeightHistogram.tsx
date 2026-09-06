"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartAccent,
  chartAxis,
  chartBarMuted,
  chartCursorFill,
  chartGrid,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "@/lib/chart-theme";

type Row = { date: string; weightKg: number };

export function WeightHistogram({
  data,
  highlightDate,
}: {
  data: Row[];
  highlightDate?: string;
}) {
  if (!data.length) {
    return (
      <p className="text-sm text-[var(--muted)] py-8 text-center">
        No weight entries yet.
      </p>
    );
  }

  const min = Math.min(...data.map((d) => d.weightKg));
  const max = Math.max(...data.map((d) => d.weightKg));

  return (
    <div className="h-52 w-full md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
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
          <YAxis
            tick={chartAxis}
            domain={[min - 1, max + 1]}
            width={36}
            tickFormatter={(v) => String(v)}
          />
          <Tooltip
            cursor={{ fill: chartCursorFill }}
            contentStyle={chartTooltipStyle}
            labelStyle={chartTooltipLabelStyle}
            itemStyle={chartTooltipItemStyle}
            formatter={(value) => [`${value} kg`, "Weight"]}
            labelFormatter={(label) => label}
          />
          <Bar
            dataKey="weightKg"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            activeBar={false}
          >
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={
                  highlightDate && entry.date === highlightDate
                    ? chartAccent
                    : chartBarMuted
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
