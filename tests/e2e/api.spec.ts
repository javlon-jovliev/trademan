import { test, expect, type APIRequestContext } from "@playwright/test";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
async function post(request: APIRequestContext, path: string, data: unknown) {
  return request.post(`/api/${path}`, { headers: { Origin: origin }, data });
}
async function login(request: APIRequestContext) {
  expect(
    (
      await post(request, "login", {
        username: process.env.SEED_USERNAME ?? "admin",
        password: process.env.SEED_PASSWORD,
      })
    ).status(),
  ).toBe(200);
}
test("API session cookies and authenticated state", async ({ request }) => {
  const r = await post(request, "login", {
    username: process.env.SEED_USERNAME ?? "admin",
    password: process.env.SEED_PASSWORD,
  });
  expect(r.status()).toBe(200);
  const cookie = r.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=lax");
  const state = await (await request.get("/api/state")).json();
  expect(state.user.passwordHash).toBeUndefined();
  expect(state.account.nlv).toBe(102430);
  expect(state.risk.rows).toHaveLength(5);
  expect(state.demo).toBe(true);
});
test("API scenario create activate duplicate and delete protections", async ({
  request,
}) => {
  await login(request);
  const original = await (await request.get("/api/state")).json();
  const first = original.account.scenarios[0];
  const name = `API policy ${Date.now()}`;
  const scenario = { ...first, name, draft: false };
  expect((await post(request, "scenario/save", { scenario })).status()).toBe(
    200,
  );
  let state = await (await request.get("/api/state")).json();
  const created = state.account.scenarios.find(
    (s: { name: string }) => s.name === name,
  );
  expect(created).toBeTruthy();
  expect(
    (await post(request, "scenario/activate", { id: created.id })).status(),
  ).toBe(200);
  expect(
    (await post(request, "scenario/delete", { id: created.id })).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "scenario/save", {
        id: created.id,
        scenario: { ...scenario, draft: true },
      })
    ).status(),
  ).toBe(400);
  state = await (await request.get("/api/state")).json();
  expect(
    state.account.scenarios.find((s: { id: string }) => s.id === created.id)
      .draft,
  ).toBe(false);
  expect(
    (await post(request, "scenario/duplicate", { id: created.id })).status(),
  ).toBe(200);
  state = await (await request.get("/api/state")).json();
  const copy = state.account.scenarios.find(
    (s: { name: string }) => s.name === `${name} (copy)`,
  );
  expect(copy.draft).toBe(true);
  expect(
    (await post(request, "scenario/activate", { id: copy.id })).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "scenario/activate", {
        id: original.account.activeScenarioId,
      })
    ).status(),
  ).toBe(200);
  expect(
    (await post(request, "scenario/delete", { id: created.id })).status(),
  ).toBe(200);
  expect(
    (await post(request, "scenario/delete", { id: copy.id })).status(),
  ).toBe(200);
});
test("API validates stops and recalculates heat", async ({ request }) => {
  await login(request);
  const original = await (await request.get("/api/state")).json();
  const position = original.risk.rows.find(
    (p: { symbol: string }) => p.symbol === "NVDA",
  );
  expect(
    (
      await post(request, "position/stop", { id: position.id, riskStop: -2 })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "position/stop", { id: position.id, riskStop: null })
    ).status(),
  ).toBe(200);
  const state = await (await request.get("/api/state")).json();
  expect(state.risk.heat).toBeNull();
  expect(state.risk.riskIncreasingBlocked).toBe(true);
  expect(
    (
      await post(request, "position/stop", {
        id: position.id,
        riskStop: position.riskStop,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(request, "position/stop", { id: "not-owned", riskStop: 100 })
    ).status(),
  ).toBe(400);
});
test("API saves and restores account preferences and trade notes", async ({
  request,
}) => {
  await login(request);
  const original = await (await request.get("/api/state")).json();
  expect(
    (
      await post(request, "settings", {
        ...original.user,
        telegramChatId: original.user.telegramChatId ?? "",
        language: "en",
        theme: "dark",
      })
    ).status(),
  ).toBe(200);
  let state = await (await request.get("/api/state")).json();
  expect(state.user.language).toBe("en");
  expect(state.user.theme).toBe("dark");
  expect(
    (
      await post(request, "settings", {
        ...original.user,
        telegramChatId: original.user.telegramChatId ?? "",
      })
    ).status(),
  ).toBe(200);
  const trade = original.account.trades[0];
  expect(
    (
      await post(request, "trade/notes", {
        id: trade.id,
        notes: "API test note",
      })
    ).status(),
  ).toBe(200);
  state = await (await request.get("/api/state")).json();
  expect(
    state.account.trades.find((t: { id: string }) => t.id === trade.id).notes,
  ).toBe("API test note");
  expect(
    (
      await post(request, "trade/notes", { id: trade.id, notes: trade.notes })
    ).status(),
  ).toBe(200);
});
test("API invalid imports and unavailable integrations fail explicitly", async ({
  request,
}) => {
  await login(request);
  expect(
    (
      await post(request, "history/import", {
        csv: "symbol,quantity\nAAPL,NaN",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, "history/bars", {
        csv: "symbol,time,open,high,low,close\nAAPL,2026-10-01,100,50,80,100",
      })
    ).status(),
  ).toBe(400);
  expect(
    (await post(request, "connections/add", { brokerId: "U1" })).status(),
  ).toBe(400);
  expect((await post(request, "telegram/test", {})).status()).toBe(400);
  expect((await post(request, "sync", {})).status()).toBe(200);
});
test("API logout revokes access", async ({ request }) => {
  await login(request);
  expect((await post(request, "logout", {})).status()).toBe(200);
  expect((await request.get("/api/state")).status()).toBe(401);
});

test("revoking other sessions keeps the current session authenticated", async ({
  request,
  playwright,
}) => {
  const other = await playwright.request.newContext({ baseURL: origin });
  await login(request);
  await login(other);
  expect((await post(request, "sessions/revoke", {})).status()).toBe(200);
  expect((await request.get("/api/state")).status()).toBe(200);
  expect((await other.get("/api/state")).status()).toBe(401);
  await other.dispose();
  const connection = await (await request.get("/api/connection")).json();
  expect(connection.mode).toBe("demo");
  expect(connection.connected).toBe(false);
});
