import { it, expect } from "vitest";
import { matchLots, type Fill } from "../broker/lots";
import { parseFlex } from "../broker/flex";
const base: Fill = {
  externalId: "1",
  conid: "10",
  symbol: "AAPL",
  quantity: 10,
  price: 100,
  fees: 1,
  multiplier: 1,
  fx: 1,
  at: new Date("2026-10-01T12:00:00Z"),
  openClose: "O",
};
it("matches FIFO partial exits and allocates fees", () => {
  const trades = matchLots([
    base,
    {
      ...base,
      externalId: "2",
      quantity: -4,
      price: 110,
      fees: 0.4,
      openClose: "C",
      at: new Date("2026-10-02T12:00:00Z"),
    },
    {
      ...base,
      externalId: "3",
      quantity: -6,
      price: 120,
      fees: 0.6,
      openClose: "C",
      at: new Date("2026-10-03T12:00:00Z"),
    },
  ]);
  expect(trades.map((t) => t.quantity)).toEqual([4, 6]);
  expect(trades[0].fees).toBeCloseTo(0.8);
  expect(trades[1].fees).toBeCloseTo(1.2);
});
it("does not invent an entry for unmatched closes", () => {
  expect(matchLots([{ ...base, openClose: "C", quantity: -10 }])).toEqual([]);
});
it("handles closing short lots", () => {
  const t = matchLots([
    { ...base, quantity: -10 },
    {
      ...base,
      externalId: "2",
      quantity: 10,
      price: 90,
      openClose: "C",
      at: new Date("2026-10-02T12:00:00Z"),
    },
  ]);
  expect(t[0].quantity).toBe(-10);
});
it("parses only account-owned execution detail from Flex", () => {
  const xml =
    '<FlexQueryResponse><FlexStatements><FlexStatement accountId="U1"><Trades><Trade tradeID="1" conid="10" symbol="AAPL" quantity="10" tradePrice="100" ibCommission="-1" multiplier="1" fxRateToBase="1" dateTime="20261001;120000" openCloseIndicator="O" levelOfDetail="EXECUTION"/></Trades></FlexStatement></FlexStatements></FlexQueryResponse>';
  expect(parseFlex(xml, "U1")[0]).toMatchObject({
    externalId: "1",
    quantity: 10,
    fees: 1,
  });
  expect(parseFlex(xml, "U2")).toEqual([]);
});
it("rejects DTD and XML entities", () => {
  expect(() => parseFlex("<!DOCTYPE root><FlexQueryResponse/>", "U1")).toThrow(
    "Unsafe",
  );
});
