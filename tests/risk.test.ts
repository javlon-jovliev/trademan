import { describe, it, expect } from "vitest";
import {
  evaluate,
  positionMetrics,
  drawdowns,
  postExit,
  type RiskPosition,
  type Policy,
} from "../risk/engine";
const p: RiskPosition = {
  id: "1",
  symbol: "TEST",
  name: "Test",
  currency: "USD",
  quantity: 100,
  averagePrice: 95,
  currentPrice: 100,
  previousClose: 98,
  multiplier: 1,
  fx: 1,
  riskStop: 90,
  sector: "Technology",
  assetClass: "STK",
};
const account = {
  nlv: 100000,
  maintenanceMargin: 20000,
  excessLiquidity: 80000,
  timezone: "America/New_York",
};
const policy: Policy = {
  maxHeat: 6,
  warningHeat: 4.5,
  maxTradeRisk: 1.5,
  maxPosition: 20,
  maxGross: 150,
  maxNet: 100,
  maxMargin: 65,
  minLiquidity: 25,
  dailyLoss: 2,
  weeklyLoss: 4,
  monthlyLoss: 6,
  totalDrawdown: 8,
  sectorLimit: 35,
  sectorLimits: {},
  assetLimits: {},
  requireStops: true,
  warningPercent: 80,
};
describe("financial calculations", () => {
  it("computes position value, P&L and heat", () => {
    expect(positionMetrics(p, 100000)).toMatchObject({
      value: 10000,
      pnl: 500,
      daily: 200,
      heat: 1,
      weight: 10,
    });
  });
  it("computes short risk and signed P&L", () => {
    expect(
      positionMetrics({ ...p, quantity: -100, riskStop: 110 }, 100000),
    ).toMatchObject({ value: -10000, pnl: -500, heat: 1 });
  });
  it("applies contract multiplier and FX", () => {
    expect(
      positionMetrics({ ...p, quantity: 2, multiplier: 100, fx: 1.2 }, 100000)
        .heat,
    ).toBeCloseTo(2.4);
  });
  it("does not fabricate missing stops", () => {
    expect(positionMetrics({ ...p, riskStop: null }, 100000).heat).toBeNull();
  });
  it("rejects undefined FX and invalid equity", () => {
    expect(positionMetrics({ ...p, fx: null }, 100000).value).toBeNull();
    expect(positionMetrics(p, 0).heat).toBeNull();
  });
  it("tracks incomplete portfolio heat", () => {
    const r = evaluate(
      [p, { ...p, id: "2", riskStop: null }],
      account,
      policy,
      [],
    );
    expect(r.heat).toBeNull();
    expect(r.knownHeat).toBe(1);
    expect(r.status).toBe("unknown");
  });
  it("uses gross exposure for mixed long and short", () => {
    const r = evaluate(
      [p, { ...p, id: "2", quantity: -100 }],
      account,
      policy,
      [],
    );
    expect(r.gross).toBe(20);
    expect(r.net).toBe(0);
    expect(r.sectors.Technology).toBe(20);
  });
  it("detects sector overrides and position breaches", () => {
    const r = evaluate(
      [{ ...p, quantity: 250 }],
      account,
      { ...policy, sectorLimits: { Technology: 10 } },
      [],
    );
    expect(
      r.violations.some(
        (v) => v.key === "sector:Technology" && v.severity === "breach",
      ),
    ).toBe(true);
    expect(r.riskIncreasingBlocked).toBe(true);
  });
  it("leaves drawdown unknown without baseline", () => {
    expect(
      drawdowns(
        [],
        100000,
        new Date("2026-10-04T12:00:00Z"),
        "America/New_York",
      ).daily,
    ).toBeNull();
  });
  it("calculates period losses and high water mark", () => {
    const d = drawdowns(
      [
        { at: "2026-09-27T20:00:00Z", nlv: 110000, externalFlow: 0 },
        { at: "2026-09-30T20:00:00Z", nlv: 108000, externalFlow: 0 },
        { at: "2026-10-03T20:00:00Z", nlv: 105000, externalFlow: 0 },
      ],
      100000,
      new Date("2026-10-04T12:00:00Z"),
      "America/New_York",
    );
    expect(d.daily).toBeCloseTo(4.7619);
    expect(d.weekly).toBeCloseTo(9.0909);
    expect(d.monthly).toBeCloseTo(7.4074);
    expect(d.total).toBeCloseTo(9.0909);
  });
  it("removes deposits from period performance", () => {
    const d = drawdowns(
      [
        { at: "2026-10-03T20:00:00Z", nlv: 100000, externalFlow: 0 },
        { at: "2026-10-04T10:00:00Z", nlv: 120000, externalFlow: 20000 },
      ],
      120000,
      new Date("2026-10-04T12:00:00Z"),
      "America/New_York",
    );
    expect(d.daily).toBe(0);
    expect(d.total).toBe(0);
  });
  it("respects broker calendar around midnight UTC", () => {
    const d = drawdowns(
      [
        { at: "2026-10-02T20:00:00Z", nlv: 100000, externalFlow: 0 },
        { at: "2026-10-03T20:00:00Z", nlv: 90000, externalFlow: 0 },
      ],
      90000,
      new Date("2026-10-04T01:00:00Z"),
      "America/New_York",
    );
    expect(d.daily).toBe(10);
  });
  it("distinguishes realized and held P&L", () => {
    const m = postExit(
      {
        quantity: 10,
        entry: 90,
        exit: 100,
        fees: 2,
        multiplier: 1,
        fx: 1,
        closedAt: "2026-10-01",
      },
      [{ time: "2026-10-02", open: 102, high: 112, low: 98, close: 110 }],
    );
    expect(m.realized).toBe(98);
    expect(m.hypothetical).toBe(198);
    expect(m.missed).toBe(100);
    expect(m.mae).toBe(-20);
    expect(m.mfe).toBe(120);
  });
  it("keeps post exit analytics unknown without bars", () => {
    expect(
      postExit(
        {
          quantity: 10,
          entry: 90,
          exit: 100,
          fees: 0,
          multiplier: 1,
          fx: 1,
          closedAt: "2026-10-01",
        },
        [],
      ).hypothetical,
    ).toBeNull();
  });
  it("evaluates short post exit excursions", () => {
    const m = postExit(
      {
        quantity: -10,
        entry: 100,
        exit: 90,
        fees: 0,
        multiplier: 1,
        fx: 1,
        closedAt: "2026-10-01",
      },
      [{ time: "2026-10-02", open: 90, high: 95, low: 80, close: 85 }],
    );
    expect(m.mfe).toBe(100);
    expect(m.mae).toBe(-50);
    expect(m.missed).toBe(50);
  });
});
