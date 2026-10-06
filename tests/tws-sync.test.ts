import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../server/db", () => ({
  db: {
    account: { findUniqueOrThrow: mocks.account, update: mocks.update },
    $transaction: mocks.transaction,
  },
}));
import { syncAccount } from "../server/portfolio";
beforeEach(() => {
  vi.stubEnv("IBKR_ADAPTER", "tws");
  vi.stubEnv("IBKR_TWS_BRIDGE_TOKEN", "test-token");
  vi.stubEnv("IBKR_TWS_BRIDGE_URL", "http://127.0.0.1:8000");
  mocks.account.mockResolvedValue({ mode: "live", brokerId: "DU1" });
  mocks.update.mockResolvedValue({});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("an incomplete TWS response marks disconnected without replacing positions or risk values", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ brokerId: "DU1", positions: [] })),
      ),
  );
  await expect(syncAccount("A")).rejects.toThrow();
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "A" },
    data: { connected: false, syncError: expect.any(String) },
  });
});
it("Gateway outage preserves stored account and positions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(Error("secret connection detail")),
  );
  await expect(syncAccount("A")).rejects.toThrow("TWS bridge unavailable");
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.update.mock.calls[0][0].data.syncError).not.toContain("secret");
});
