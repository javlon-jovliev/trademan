"use client";
import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Bar } from "@/risk/engine";
export function Candles({
  bars,
  entry,
  exit,
  entryLabel,
  exitLabel,
  emptyLabel,
}: {
  bars: Bar[];
  entry: string;
  exit: string;
  entryLabel: string;
  exitLabel: string;
  emptyLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prices = useMemo(() => {
    const byTime = new Map<
      number,
      {
        time: UTCTimestamp;
        open: number;
        high: number;
        low: number;
        close: number;
      }
    >();
    for (const b of bars) {
      const time = new Date(b.time).getTime() / 1000;
      if (
        !Number.isFinite(time) ||
        ![b.open, b.high, b.low, b.close].every(Number.isFinite) ||
        b.high < Math.max(b.open, b.close, b.low) ||
        b.low > Math.min(b.open, b.close)
      )
        continue;
      byTime.set(time, {
        time: time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      });
    }
    return [...byTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
  }, [bars]);
  useEffect(() => {
    if (!ref.current || !prices.length) return;
    const chart = createChart(ref.current, {
      height: 250,
      width: ref.current.clientWidth,
      autoSize: true,
      timeScale: { lockVisibleTimeRangeOnResize: true },
      layout: {
        background: {
          color: getComputedStyle(ref.current)
            .getPropertyValue("--soft")
            .trim(),
        },
        textColor: getComputedStyle(ref.current)
          .getPropertyValue("--muted")
          .trim(),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: {
          color: getComputedStyle(ref.current)
            .getPropertyValue("--border")
            .trim(),
        },
      },
    });
    const series = chart.addSeries(CandlestickSeries);
    series.setData(prices);
    const markers = [
      {
        time: (new Date(entry.slice(0, 10)).getTime() / 1000) as UTCTimestamp,
        position: "belowBar" as const,
        color: "#2563eb",
        shape: "arrowUp" as const,
        text: entryLabel,
      },
      {
        time: (new Date(exit.slice(0, 10)).getTime() / 1000) as UTCTimestamp,
        position: "aboveBar" as const,
        color: "#dc2626",
        shape: "arrowDown" as const,
        text: exitLabel,
      },
    ]
      .filter((m) => prices.some((b) => b.time === m.time))
      .sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
    };
  }, [prices, entry, exit, entryLabel, exitLabel]);
  if (!prices.length) return <div className="chart-empty">{emptyLabel}</div>;
  return (
    <div
      ref={ref}
      className="candles"
      aria-label={`${entryLabel} / ${exitLabel}`}
    />
  );
}
