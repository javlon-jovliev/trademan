import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const pages = [
  "dashboard",
  "portfolio",
  "history",
  "scenarios",
  "scenarios/new",
  "settings",
];
for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 1440]) {
    test(`UI audit ${theme} ${width}px`, async ({ page }) => {
      test.setTimeout(120000);
      const response = await page.request.post("/api/login", {
        headers: { Origin: origin },
        data: {
          username: process.env.SEED_USERNAME ?? "admin",
          password: process.env.SEED_PASSWORD,
        },
      });
      expect(response.ok()).toBeTruthy();
      const state = await (await page.request.get("/api/state")).json();
      const settings = {
        ...state.user,
        telegramChatId: state.user.telegramChatId ?? "",
      };
      await page.request.post("/api/settings", {
        headers: { Origin: origin },
        data: { ...settings, language: "en", theme },
      });
      try {
        await page.setViewportSize({ width, height: 900 });
        for (const route of pages) {
          await page.goto(`/${route}`);
          await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme,
          );
          await expect(page.locator("main h1")).toBeVisible();
          await expect(page.locator("main")).toHaveAttribute(
            "aria-busy",
            "false",
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
            route,
          ).toBeLessThanOrEqual(width);
          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          expect(
            results.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target),
            })),
            route,
          ).toEqual([]);
          await page.screenshot({
            path: `test-results/ui-${theme}-${width}-${route.replaceAll("/", "-")}.png`,
            fullPage: true,
          });
        }
      } finally {
        await page.request.post("/api/settings", {
          headers: { Origin: origin },
          data: settings,
        });
      }
    });
  }
}
test("mobile navigation traps focus, closes with Escape and Settings", async ({
  page,
}) => {
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const menu = page.locator(".mobile-menu");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Settings|Sozlamalar/, exact: true })
    .click();
  await expect(page).toHaveURL(/settings$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});
test("expanded history fits mobile, charts resize, drawer errors are visible", async ({
  page,
}) => {
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/history");
  await page.getByRole("cell", { name: "TSLA", exact: true }).click();
  await expect(page.locator(".trade-details textarea")).toHaveCount(0);
  await expect(page.locator(".analysis-card")).toHaveCount(3);
  const details = await page.locator(".trade-details").boundingBox();
  expect(details!.x + details!.width).toBeLessThanOrEqual(390);
  const chart = await page.locator(".candles canvas").first().boundingBox();
  expect(chart!.width).toBeLessThanOrEqual(details!.width);
  expect(chart!.height).toBeGreaterThan(200);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({
    path: "test-results/history-mobile-expanded.png",
    fullPage: true,
  });
  await page.goto("/portfolio");
  await page.getByRole("cell", { name: "NVDA NVIDIA Corp." }).click();
  await page.route("**/api/position/stop", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Stop validation failed" }),
    }),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Save|Saqlash/, exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Stop validation failed",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("filters and settings/editor subviews remain accessible", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["portfolio", "history"]) {
    await page.goto(`/${route}`);
    await page.getByRole("button", { name: /Filters|Filtrlar/ }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  for (const route of ["scenarios/new", "settings"]) {
    await page.goto(`/${route}`);
    await expect(page.locator(".tabs button").first()).toBeVisible();
    const tabs = page.locator(".tabs button");
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations.map((v) => v.id),
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
    }
  }
});

test("compact account menu, notification menu and session request failure", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  const state = await (await page.request.get("/api/state")).json();
  const prefs = {
    ...state.user,
    telegramChatId: state.user.telegramChatId ?? "",
  };
  await page.request.post("/api/settings", {
    headers: { Origin: origin },
    data: { ...prefs, collapsed: true, language: "en" },
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings");
    await page
      .getByRole("button", { name: "Account menu", exact: true })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: "English", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Alerts \(/ }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await expect(page.locator(".notifications-menu")).not.toContainText(
      /cm[a-z0-9]{20}/,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".save-toast")).toContainText("Saved");
    const toast = await page.locator(".save-toast").boundingBox();
    expect(toast?.width).toBeLessThan(220);
    await expect(page.locator(".save-toast")).toHaveCount(0, { timeout: 5000 });
    await page.route("**/api/sessions/revoke", (route) =>
      route.abort("failed"),
    );
    await page
      .getByRole("button", { name: "Revoke other sessions", exact: true })
      .click();
    await expect(page.locator(".session-action [role=alert]")).toContainText(
      "Connection failed",
    );
    await page.unroute("**/api/sessions/revoke");
    await page
      .getByRole("button", { name: "Revoke other sessions", exact: true })
      .click();
    await expect(page.locator(".session-action [role=status]")).toContainText(
      "This session remains active",
    );
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.post("/api/settings", {
      headers: { Origin: origin },
      data: prefs,
    });
  }
});

test("large alert lists paginate and read alerts remain available", async ({
  page,
}) => {
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  const state = await (await page.request.get("/api/state")).json();
  state.user.language = "en";
  state.account.alerts = Array.from({ length: 14 }, (_, i) => ({
    id: `audit-alert-${i}`,
    accountId: state.account.id,
    key: `sector:Example ${i}`,
    severity: "warning",
    message: `Example ${i}: 30 / 35`,
    active: true,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  }));
  await page.route("**/api/state", (route) => route.fulfill({ json: state }));
  await page.route("**/api/alert/ack", (route) => {
    const { id } = route.request().postDataJSON();
    state.account.alerts.find((a: { id: string }) => a.id === id).acknowledged =
      true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Alerts (14)", exact: true }).click();
  await expect(page.locator(".notification-item")).toHaveCount(10);
  const menu = await page.locator(".notifications-menu").boundingBox();
  expect(menu!.height).toBeLessThanOrEqual(480);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(390);
  await page
    .getByRole("menuitem", { name: "Show more (4)", exact: true })
    .click();
  await expect(page.locator(".notification-item")).toHaveCount(14);
  await page.locator(".notification-item").first().click();
  await expect(
    page.getByRole("button", { name: "Alerts (13)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("menuitemradio", { name: "Read (1)", exact: true })
    .click();
  await expect(page.locator(".notification-item")).toHaveCount(1);
  await expect(page.locator(".notification-item")).toContainText("Example 0");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
});

test("value explanations work with hover, keyboard and touch without opening position rows", async ({
  page,
}) => {
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-kpis .kpi-help")).toHaveCount(0);
  const help = page.locator(".dashboard-kpis .help-trigger").first();
  await help.hover();
  await expect(page.getByRole("tooltip")).toContainText(/liquidation|kapitali/);
  await help.focus();
  await help.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.goto("/portfolio");
  await page.getByRole("cell", { name: "NVDA NVIDIA Corp." }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.locator(".drawer-close")).toBeVisible();
  await expect(drawer.locator(".drawer-close")).toHaveText("");
  await expect(drawer.locator(".position-costs")).toContainText(
    /commission|Komissiya/,
  );
  await drawer.locator(".drawer-close").click();
  await expect(drawer).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.locator(".dashboard-kpis .help-trigger").first().click();
  const bounds = await page.getByRole("tooltip").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
});

test("compact table tools filter rows, reset criteria and export filtered results", async ({
  page,
}) => {
  await page.request.post("/api/login", {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  await page.goto("/portfolio");
  await page
    .getByRole("button", { name: /Filters|Filtrlar/, exact: true })
    .click();
  const filters = page.getByRole("dialog");
  await filters
    .getByLabel(/Side|Yo‘nalish/, { exact: true })
    .selectOption("short");
  await filters.locator(".filter-footer .primary").click();
  await expect(page.locator("tbody > tr")).toHaveCount(1);
  await expect(page.getByRole("cell", { name: /XOM/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: /Export CSV|CSV eksport|CSV chiqarish/,
      exact: true,
    })
    .click();
  expect((await download).suggestedFilename()).toBe("portfolio.csv");
  await page
    .getByRole("button", { name: /Filters|Filtrlar/, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Clear|Tozalash/, exact: true })
    .click();
  await page.getByRole("dialog").locator(".filter-footer .primary").click();
  await expect(page.locator("tbody > tr")).toHaveCount(5);
  await page.goto("/history");
  await page
    .getByRole("button", { name: /Filters|Filtrlar/, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel(/Reason|Sabab/, { exact: true })
    .selectOption("stop_loss");
  await page.getByRole("dialog").locator(".filter-footer .primary").click();
  await expect(page.locator("tbody > tr")).toHaveCount(1);
  await expect(
    page.getByRole("cell", { name: "AMD", exact: true }),
  ).toBeVisible();
});
