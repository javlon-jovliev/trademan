import { it, expect } from "vitest";
import { parseCSV, tradeImport, barImport } from "../server/imports";
import { scenarioSchema } from "../server/validation";
import { en, uz } from "../i18n/dictionaries";
it("parses quoted CSV and escaped quotes", () => {
  expect(
    parseCSV('symbol,name\r\nAAPL,"Apple, Inc."\r\nTEST,"A ""quoted"" name"'),
  ).toEqual([
    { symbol: "AAPL", name: "Apple, Inc." },
    { symbol: "TEST", name: 'A "quoted" name' },
  ]);
});
it("rejects malformed CSV", () => {
  expect(() => parseCSV("a,b\n1")).toThrow();
  expect(() => parseCSV("a,a\n1,2")).toThrow();
  expect(() => parseCSV('a\n"b')).toThrow();
});
it("validates OHLC bounds", () => {
  expect(
    barImport.safeParse({
      symbol: "A",
      time: "2026-10-01",
      open: 100,
      high: 90,
      low: 80,
      close: 95,
    }).success,
  ).toBe(false);
});
it("rejects trades with invalid chronology", () => {
  expect(
    tradeImport.safeParse({
      symbol: "A",
      quantity: 1,
      entry: 100,
      exit: 110,
      openedAt: "2026-10-03T12:00:00Z",
      closedAt: "2026-10-01T12:00:00Z",
      reason: "manual",
      fees: 0,
      externalId: "1",
    }).success,
  ).toBe(false);
});
it("rejects invalid policy fields", () => {
  expect(scenarioSchema.safeParse({ name: "X", maxHeat: -1 }).success).toBe(
    false,
  );
});
it("has matching translation keys", () => {
  expect(Object.keys(uz).sort()).toEqual(Object.keys(en).sort());
});
