import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { TWSAdapter } from "../broker/tws";
import { createBrokerAdapter } from "../broker/factory";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("IBKR_TWS_BRIDGE_TOKEN", "test-token");
  vi.stubEnv("IBKR_TWS_BRIDGE_URL", "http://127.0.0.1:8000");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const snapshot = {
  brokerId: "DU1",
  currency: "USD",
  nlv: 100,
  cash: 20,
  buyingPower: null,
  maintenanceMargin: null,
  excessLiquidity: null,
  positions: [
    {
      conid: "1",
      symbol: "OPT",
      name: "Option",
      quantity: -2,
      averagePrice: 3,
      currentPrice: null,
      previousClose: null,
      multiplier: 100,
      fx: null,
      currency: "EUR",
      assetClass: "OPT",
      sector: "Unknown",
    },
  ],
};
function reply(body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body)));
}
it("normalizes the same snapshot contract without inventing prices or FX", async () => {
  reply(snapshot);
  expect(await new TWSAdapter().snapshot("DU1")).toEqual(snapshot);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer test-token",
  );
});
it("rejects wrong accounts, duplicate positions, invalid multipliers and partial data", async () => {
  for (const bad of [
    { ...snapshot, brokerId: "DU2" },
    { ...snapshot, positions: [...snapshot.positions, ...snapshot.positions] },
    { ...snapshot, positions: [{ ...snapshot.positions[0], multiplier: 0 }] },
    { positions: [] },
  ]) {
    reply(bad);
    await expect(new TWSAdapter().snapshot("DU1")).rejects.toThrow();
  }
});
it("does not leak response bodies or credentials on failure", async () => {
  fetchMock.mockResolvedValue(
    new Response("sensitive broker response", { status: 503 }),
  );
  await expect(new TWSAdapter().snapshot("DU1")).rejects.toThrow("HTTP 503");
});
it("requires an explicit known adapter and keeps web as the default", () => {
  vi.stubEnv("IBKR_ADAPTER", "tws");
  expect(createBrokerAdapter()).toBeInstanceOf(TWSAdapter);
  vi.stubEnv("IBKR_ADAPTER", "invalid");
  expect(createBrokerAdapter).toThrow("must be web or tws");
  vi.stubEnv("IBKR_ADAPTER", "web");
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  expect(createBrokerAdapter()).not.toBeInstanceOf(TWSAdapter);
});
it("rejects untrusted cleartext endpoints", () => {
  vi.stubEnv("IBKR_TWS_BRIDGE_URL", "http://example.com");
  expect(() => new TWSAdapter()).toThrow("requires HTTPS");
});
it("filters stale, future and crossed quotes", async () => {
  const now = new Date();
  const good = { conid: "1", bid: 10, ask: 11, at: now, observedAt: now };
  reply([
    good,
    { ...good, bid: 12 },
    { ...good, at: new Date(+now - 16000) },
    { ...good, at: new Date(+now + 100000) },
  ]);
  expect(await new TWSAdapter().quotes("DU1", ["1"])).toEqual([good]);
});
it("merges annual history and validates candle geometry", async () => {
  const bar = { time: "2025-01-02", open: 10, high: 12, low: 9, close: 11 };
  reply([bar]);
  reply([bar, { ...bar, time: "2024-01-02" }]);
  expect(
    await new TWSAdapter().history("1", {
      from: new Date("2024-01-01"),
      to: new Date("2026-01-01"),
    }),
  ).toHaveLength(2);
  reply([{ ...bar, high: 8 }]);
  await expect(new TWSAdapter().history("1")).rejects.toThrow();
});
