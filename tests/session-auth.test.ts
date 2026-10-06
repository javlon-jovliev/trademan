import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  set: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "test-token" }),
    set: mocks.set,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../server/db", () => ({
  db: {
    session: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
  },
  demoMode: () => false,
}));
import { renewSession } from "../server/auth";
beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("rejects an expired idle session without extending or issuing a cookie", async () => {
  const now = new Date();
  mocks.findUnique.mockResolvedValue({ createdAt: now, expiresAt: now });
  expect(await renewSession()).toBe(false);
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it("rejects a session beyond the five-hour limit even with a later idle deadline", async () => {
  const now = Date.now();
  mocks.findUnique.mockResolvedValue({
    createdAt: new Date(now - 5 * 3600000 - 1),
    expiresAt: new Date(now + 3600000),
  });
  expect(await renewSession()).toBe(false);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it("does not recreate a concurrently revoked session", async () => {
  const now = Date.now();
  mocks.findUnique.mockResolvedValue({
    createdAt: new Date(now),
    expiresAt: new Date(now + 1800000),
  });
  mocks.updateMany.mockResolvedValue({ count: 0 });
  expect(await renewSession()).toBe(false);
  expect(mocks.set).not.toHaveBeenCalled();
});
it("caps renewed cookie and database deadline at the absolute limit", async () => {
  vi.useFakeTimers();
  const now = new Date("2026-10-07T04:55:00Z");
  vi.setSystemTime(now);
  mocks.findUnique.mockResolvedValue({
    createdAt: new Date("2026-10-07T00:00:00Z"),
    expiresAt: new Date(+now + 60000),
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  expect(await renewSession()).toBe(true);
  expect(mocks.updateMany.mock.calls[0][0].data.expiresAt).toEqual(
    new Date("2026-10-07T05:00:00Z"),
  );
  expect(mocks.set.mock.calls[0][2]).toMatchObject({
    maxAge: 300,
    httpOnly: true,
    sameSite: "lax",
  });
});
