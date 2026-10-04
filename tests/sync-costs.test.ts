import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  quote: vi.fn(),
  saveFill: vi.fn(),
  fills: vi.fn(),
  saveTrade: vi.fn(),
  saveAccount: vi.fn(),
  fetchFlex: vi.fn(),
  quotes: vi.fn(),
  saveQuotes: vi.fn(),
}));
vi.mock("../server/db", () => ({
  db: {
    account: { findUniqueOrThrow: mocks.account, update: mocks.saveAccount },
    marketQuote: { findFirst: mocks.quote, createMany: mocks.saveQuotes },
    execution: { upsert: mocks.saveFill, findMany: mocks.fills },
    trade: { upsert: mocks.saveTrade },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));
vi.mock("../broker/flex", () => ({ fetchFlex: mocks.fetchFlex }));
vi.mock("../broker/ibkr", () => ({
  IBKRAdapter: class {
    quotes = mocks.quotes;
  },
}));
import { syncHistory, syncQuotes } from "../server/portfolio";
beforeEach(() => vi.resetAllMocks());
it("matches only pre-execution quotes from the same account/contract and retains prior benchmarks on refresh", async () => {
  const fill = {
    externalId: "1",
    conid: "10",
    symbol: "A",
    quantity: 10,
    price: 100,
    fees: 1,
    feeFx: 1,
    multiplier: 1,
    fx: 1,
    openClose: "O",
    at: new Date("2026-10-01T12:00:00Z"),
  };
  mocks.account.mockResolvedValue({
    mode: "live",
    brokerId: "U1",
    currency: "USD",
  });
  mocks.fetchFlex.mockResolvedValue([fill]);
  mocks.fills.mockResolvedValue([fill]);
  mocks.quote
    .mockResolvedValueOnce({
      bid: 98,
      ask: 100,
      at: new Date(+fill.at - 10000),
    })
    .mockResolvedValueOnce(null);
  await syncHistory("A");
  expect(mocks.fetchFlex).toHaveBeenCalledWith("U1", "USD");
  expect(mocks.quote.mock.calls[0][0].where).toMatchObject({
    accountId: "A",
    conid: "10",
    observedAt: { lt: fill.at, gte: new Date(+fill.at - 30000) },
  });
  expect(mocks.saveFill.mock.calls[0][0].create.benchmarkPrice).toBe(99);
  await syncHistory("A");
  expect(mocks.saveFill.mock.calls[1][0].update).not.toHaveProperty(
    "benchmarkPrice",
  );
  expect(mocks.saveFill.mock.calls[1][0].update).not.toHaveProperty(
    "benchmarkAt",
  );
});
it("quote capture cannot contact a live broker or write quotes for demo accounts", async () => {
  mocks.account.mockResolvedValue({ mode: "demo", positions: [] });
  await syncQuotes("D");
  expect(mocks.quotes).not.toHaveBeenCalled();
  expect(mocks.saveQuotes).not.toHaveBeenCalled();
});
