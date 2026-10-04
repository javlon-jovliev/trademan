import { it, expect } from "vitest";
import { fillFee, fillSlippage, matchLots, type Fill } from "../broker/lots";
import { executionCosts } from "../risk/costs";
import { postExit } from "../risk/engine";
import { parseFlex } from "../broker/flex";
const fill: Fill = {
  externalId: "open",
  conid: "1",
  symbol: "A",
  quantity: 10,
  price: 100,
  fees: 2,
  feeFx: 1.1,
  fx: 1.1,
  multiplier: 1,
  at: new Date("2026-10-01T10:00:00Z"),
  openClose: "O",
  benchmarkPrice: 99,
  benchmarkAt: new Date("2026-10-01T09:59:50Z"),
};
it("converts each commission using its own currency rate, allocates partial exits and preserves remaining fees", () => {
  const close: Fill = {
    ...fill,
    externalId: "close",
    quantity: -4,
    fees: 1,
    feeFx: 1.3,
    fx: 1.3,
    price: 110,
    openClose: "C",
    at: new Date("2026-10-02T10:00:00Z"),
    benchmarkPrice: 111,
    benchmarkAt: new Date("2026-10-02T09:59:50Z"),
  };
  const trade = matchLots([close, fill])[0];
  expect(trade.entryFee).toBeCloseTo(0.88);
  expect(trade.exitFee).toBeCloseTo(1.3);
  expect(trade.fees).toBeCloseTo(2.18);
  expect(trade.slippage).toBeCloseTo(4.4 + 5.2);
  const costs = executionCosts(
    [close, fill],
    [{ conid: "1", quantity: 6, currentPrice: 120, multiplier: 1, fx: 1.3 }],
    10000,
  );
  expect(costs.positions["1"].commission).toBeCloseTo(1.32);
  expect(costs.positions["1"].netPnl).toBeCloseTo(156 - 1.32);
  expect(costs.summary.commission).toBeCloseTo(3.5);
  // Slippage is already in fill prices, never deducted again.
  expect(postExit(trade, []).realized).toBeCloseTo(52 - 2.18);
});
it("distinguishes price improvement from adverse short execution", () => {
  expect(
    fillSlippage({ ...fill, quantity: -10, benchmarkPrice: 101 }),
  ).toBeCloseTo(11);
  expect(
    fillSlippage({ ...fill, quantity: -10, benchmarkPrice: 99 }),
  ).toBeCloseTo(-11);
  expect(fillFee({ ...fill, fees: -1 })).toBeCloseTo(-1.1);
});
it("rejects same-time, future, missing and stale benchmarks without pretending zero slippage", () => {
  for (const benchmarkAt of [
    null,
    new Date(+fill.at),
    new Date(+fill.at + 1),
    new Date(+fill.at - 30001),
  ])
    expect(fillSlippage({ ...fill, benchmarkAt })).toBeNull();
  const costs = executionCosts([{ ...fill, benchmarkPrice: null }], [], 1000);
  expect(costs.summary.slippage).toBeNull();
  expect(costs.summary.total).toBeNull();
});
it("partial coverage has a measured subtotal, not a complete total", () => {
  const c = executionCosts(
    [fill, { ...fill, externalId: "2", benchmarkPrice: null }],
    [],
    1000,
  ).summary;
  expect(c.coverage).toBe(50);
  expect(c.slippage).toBeCloseTo(11);
  expect(c.total).toBeNull();
});
it("missing opening lots or fee FX keeps open-position net P&L unavailable", () => {
  const p = {
    conid: "1",
    quantity: 20,
    currentPrice: 120,
    multiplier: 1,
    fx: 1,
  };
  expect(executionCosts([fill], [p], 1000).positions["1"].netPnl).toBeNull();
  expect(
    executionCosts([{ ...fill, feeFx: null }], [{ ...p, quantity: 10 }], 1000)
      .positions["1"].commission,
  ).toBeNull();
  expect(fillFee({ ...fill, feeFx: null, fees: 0 })).toBe(0);
  expect(executionCosts([], [p], 1000).summary.commission).toBeNull();
});
it("unknown commission cannot be advertised as a net realized result", () => {
  const trade = matchLots([
    fill,
    {
      ...fill,
      externalId: "close",
      quantity: -10,
      feeFx: null,
      price: 110,
      openClose: "C",
      at: new Date(+fill.at + 10000),
    },
  ])[0];
  expect(trade.feesKnown).toBe(false);
  expect(postExit(trade, []).realized).toBeNull();
});
it("Flex uses base-currency commissions without applying asset FX again and retains rebates", () => {
  const xml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U1"><Trades><Trade tradeID="1" conid="1" symbol="A" quantity="10" tradePrice="100" currency="EUR" ibCommissionCurrency="USD" ibCommission="0.25" multiplier="1" fxRateToBase="1.1" dateTime="20261001;120000" openCloseIndicator="O" levelOfDetail="EXECUTION"/></Trades></FlexStatement></FlexStatements></FlexQueryResponse>`;
  const f = parseFlex(xml, "U1", "USD")[0];
  expect(f.feeFx).toBe(1);
  expect(fillFee(f)).toBe(-0.25);
  expect(
    fillFee(
      parseFlex(
        xml.replace('ibCommissionCurrency="USD"', 'ibCommissionCurrency="GBP"'),
        "U1",
        "USD",
      )[0],
    ),
  ).toBeNull();
});
