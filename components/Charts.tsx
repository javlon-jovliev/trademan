"use client";
import { useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Bar } from "@/risk/engine";
export function EquityChart({
  points,
}: {
  points: { at: string; nlv: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <XAxis
            dataKey="at"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
            minTickGap={50}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={65}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v) =>
              new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 2,
              }).format(Number(v))
            }
            labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
          />
          <Area
            type="monotone"
            dataKey="nlv"
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
export function Candles({
  bars,
  entry,
  exit,
}: {
  bars: Bar[];
  entry: string;
  exit: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !bars.length) return;
    const chart = createChart(ref.current, {
      height: 250,
      layout: { background: { color: "#ffffff" }, textColor: "#64748b" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#f1f5f9" } },
    });
    const series = chart.addSeries(CandlestickSeries);
    series.setData(
      bars.map((b) => ({
        ...b,
        time: (new Date(b.time).getTime() / 1000) as UTCTimestamp,
      })),
    );
    const markers = [
      {
        time: (new Date(entry.slice(0, 10)).getTime() / 1000) as UTCTimestamp,
        position: "belowBar" as const,
        color: "#2563eb",
        shape: "arrowUp" as const,
        text: "Entry",
      },
      {
        time: (new Date(exit.slice(0, 10)).getTime() / 1000) as UTCTimestamp,
        position: "aboveBar" as const,
        color: "#dc2626",
        shape: "arrowDown" as const,
        text: "Exit",
      },
    ]
      .filter((m) => bars.some((b) => +new Date(b.time) / 1000 === m.time))
      .sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
    const observer = new ResizeObserver((entries) =>
      chart.applyOptions({ width: entries[0].contentRect.width }),
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [bars, entry, exit]);
  return <div ref={ref} className="candles" />;
}
