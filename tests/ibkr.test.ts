import { it, expect, vi, afterEach } from "vitest";
import { IBKRAdapter } from "../broker/ibkr";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("reads paginated broker data and preserves unknown FX", async () => {
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  const payloads = [
    { authenticated: true, connected: true },
    [{ accountId: "U1" }],
    { BASE: { netliquidationvalue: 100000, cashbalance: 50000 } },
    {
      netliquidation: { amount: 100000, currency: "USD" },
      buyingpower: { amount: 200000 },
    },
    [
      {
        conid: 1,
        contractDesc: "AAPL",
        position: 100,
        avgCost: 95,
        mktPrice: 100,
        currency: "EUR",
        assetClass: "STK",
      },
    ],
  ];
  const mock = vi.fn().mockImplementation(async () => ({
    ok: true,
    json: async () => payloads.shift(),
  }));
  vi.stubGlobal("fetch", mock);
  const r = await new IBKRAdapter().snapshot("U1");
  expect(r.positions[0].fx).toBeNull();
  expect(r.nlv).toBe(100000);
  expect(mock.mock.calls[0][1].method).toBe("POST");
  expect(
    mock.mock.calls.every(([url]) => !String(url).includes("/orders")),
  ).toBe(true);
});
it("fails when gateway is unauthenticated", async () => {
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ authenticated: false, connected: false }),
    })),
  );
  await expect(new IBKRAdapter().snapshot("U1")).rejects.toThrow(
    "Authenticate",
  );
});
it("does not fall back to demo on failed requests", async () => {
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 503 })),
  );
  await expect(new IBKRAdapter().snapshot("U1")).rejects.toThrow("503");
});

it("paginates daily history backwards with fixed UTC windows and deduplicates", async () => {
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  const bar = (date: string, close = 10) => ({
    t: +new Date(date),
    o: 10,
    h: 12,
    l: 8,
    c: close,
  });
  const payloads = [
    { data: [bar("2026-01-01"), bar("2025-11-01")] },
    { data: [bar("2025-01-01"), bar("2025-11-01")] },
  ];
  const mock = vi
    .fn()
    .mockImplementation(async () => ({
      ok: true,
      json: async () => payloads.shift(),
    }));
  vi.stubGlobal("fetch", mock);
  const bars = await new IBKRAdapter().history("123", {
    from: new Date("2024-12-01"),
    to: new Date("2026-06-01"),
  });
  expect(bars.map((b) => b.time)).toEqual([
    "2025-01-01",
    "2025-11-01",
    "2026-01-01",
  ]);
  expect(mock).toHaveBeenCalledTimes(2);
  const queries = mock.mock.calls.map(([url]) => new URL(url).searchParams);
  expect(queries[0].get("startTime")).toBe("20260601-00:00:00");
  expect(queries[1].get("startTime")).toBe("20250601-00:00:00");
  expect(
    queries.every((q) => q.get("direction") === "-1" && q.get("bar") === "1d"),
  ).toBe(true);
});
it("fails on denied historical data instead of inventing prices", async () => {
  vi.stubEnv("IBKR_GATEWAY_URL", "https://localhost:5000/v1/api");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 403 })),
  );
  await expect(new IBKRAdapter().history("123")).rejects.toThrow("403");
});
