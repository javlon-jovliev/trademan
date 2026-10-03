"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export function EquityChart({
  points,
  label,
  currency,
}: {
  points: { at: string; nlv: number }[];
  label: string;
  currency: string;
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <XAxis
            dataKey="at"
            tick={{ fill: "var(--muted)" }}
            stroke="var(--border)"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: "var(--muted)" }}
            stroke="var(--border)"
            domain={["auto", "auto"]}
            width={65}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
              borderRadius: 8,
            }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(v) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                maximumFractionDigits: 2,
              }).format(Number(v))
            }
            labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
          />
          <Area
            type="monotone"
            dataKey="nlv"
            name={label}
            stroke="#2563EB"
            fill="#2563EB"
            fillOpacity={0.08}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
