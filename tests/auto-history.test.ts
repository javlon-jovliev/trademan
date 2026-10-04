import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  saveAccount: vi.fn(),
  trades: vi.fn(),
  saveTrades: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../server/db", () => ({
  db: {
    account: { findUniqueOrThrow: mocks.account, update: mocks.saveAccount },
    trade: { findMany: mocks.trades, updateMany: mocks.saveTrades },
  },
}));
vi.mock("../broker/ibkr", () => ({
  IBKRAdapter: class {
    history = mocks.history;
  },
}));
import { syncBars } from "../server/portfolio";
beforeEach(() => vi.resetAllMocks());
const bar = (time: string) => ({ time, open: 10, high: 12, low: 8, close: 11 });
it("retains cached history and saves other contracts when one contract fails", async () => {
  mocks.account.mockResolvedValue({ id: "A", mode: "live" });
  mocks.trades.mockResolvedValue([
    { conid: "1", openedAt: new Date("2020-01-01"), bars: [bar("2020-01-01")] },
    { conid: "2", openedAt: new Date("2020-01-01"), bars: [bar("2020-01-01")] },
  ]);
  mocks.history.mockImplementation(async (conid: string) => {
    if (conid === "2") throw Error("denied");
    return [bar("2026-01-01")];
  });
  await expect(syncBars("A")).rejects.toThrow("incomplete");
  expect(mocks.saveTrades).toHaveBeenCalledTimes(1);
  expect(
    mocks.saveTrades.mock.calls[0][0].data.bars.map(
      (b: { time: string }) => b.time,
    ),
  ).toEqual(["2020-01-01", "2026-01-01"]);
  expect(mocks.saveAccount.mock.calls[0][0].data.barsError).toContain(
    "Automatic retry",
  );
});
it("demo history never requests real broker data", async () => {
  mocks.account.mockResolvedValue({ id: "D", mode: "demo" });
  await syncBars("D");
  expect(mocks.history).not.toHaveBeenCalled();
});
