"use client";
import { useEffect, useRef } from "react";
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
}: {
  bars: Bar[];
  entry: string;
  exit: string;
  entryLabel: string;
  exitLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !bars.length) return;
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
      .filter((m) => bars.some((b) => +new Date(b.time) / 1000 === m.time))
      .sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
    };
  }, [bars, entry, exit, entryLabel, exitLabel]);
  return <div ref={ref} className="candles" />;
}
