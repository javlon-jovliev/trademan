import type { Violation } from "./engine";
import { en, uz, type Key } from "../i18n/dictionaries";
export function riskAlertText(v: Violation, language: "uz" | "en") {
  const words = language === "en" ? en : uz;
  const [kind, subject] = v.key.split(":");
  const labels: Record<string, Key> = {
    heat: "heat",
    gross: "maxGross",
    net: "maxNet",
    margin: "maxMargin",
    liquidity: "minLiquidity",
    daily: "dailyLoss",
    weekly: "weeklyLoss",
    monthly: "monthlyLoss",
    total: "totalDrawdown",
    position: "maxPosition",
    trade: "maxTradeRisk",
    sector: "sectorLimit",
    asset: "assetLimits",
    scenario: "scenario",
  };
  const label = words[labels[kind] ?? "risk"].replace(/\s*%$/, "");
  const prefix = `${subject ? subject + " · " : ""}${label}`;
  if (v.value === null || v.severity === "unknown")
    return `${prefix}: ${kind === "scenario" ? words.noScenario : words.riskDataMissing}`;
  const value = `${v.value.toFixed(2)}%`,
    limit = v.limit === null ? "—" : `${v.limit.toFixed(2)}%`;
  return `${prefix}: ${value} (${words.limitLabel}: ${limit}). ${v.severity === "breach" ? (kind === "liquidity" ? words.belowMinimum : words.limitExceeded) : words.nearLimit}`;
}
