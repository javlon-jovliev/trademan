import { it, expect } from "vitest";
import { valueExplanation } from "../risk/definitions";
import { en, uz } from "../i18n/dictionaries";
it("explains ambiguous financial values in both languages with account units", () => {
  for (const key of [
    "heat",
    "maxTradeRisk",
    "maxGross",
    "dailyLoss",
    "realized",
    "hypothetical",
    "mae",
    "mfe",
    "slippageCost",
    "netExecutionPnl",
  ] as const) {
    expect(valueExplanation(en[key], "en")).toBeTruthy();
    expect(valueExplanation(uz[key], "uz")).toBeTruthy();
    expect(valueExplanation(uz[key], "uz")).not.toBe(
      valueExplanation(en[key], "en"),
    );
  }
  expect(valueExplanation(en.netLiquidation, "en", "EUR")).toContain("EUR");
  expect(valueExplanation(uz.closedAt, "uz", "USD", "Asia/Dubai")).toContain(
    "Asia/Dubai",
  );
  expect(valueExplanation("UNKNOWN LABEL", "en")).toBeUndefined();
});

it("distinguishes per-position risk from total portfolio heat even when their displayed names coincide", () => {
  expect(
    valueExplanation(uz.riskTab, "uz", "USD", "America/New_York", "riskTab"),
  ).toContain("Shu pozitsiyaning");
  expect(valueExplanation(uz.heat, "uz")).toContain("Barcha pozitsiyalar");
});
