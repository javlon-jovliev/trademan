import { test, expect } from "@playwright/test";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
test("authentication, portfolio, history, scenarios and preferences", async ({
  page,
}) => {
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/login/);
  await page
    .getByLabel("Foydalanuvchi nomi")
    .fill(process.env.SEED_USERNAME ?? "admin");
  await page
    .getByLabel("Parol", { exact: true })
    .fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bosh sahifa", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$102,430.00", { exact: true })).toBeVisible();
  await page.goto("/portfolio");
  await expect(
    page.getByRole("cell", { name: "NVDA NVIDIA Corp." }),
  ).toBeVisible();
  await page.getByPlaceholder("Aktiv yoki kompaniyani qidirish").fill("NVDA");
  await expect(page.locator("tbody>tr")).toHaveCount(1);
  await page.getByRole("cell", { name: "NVDA NVIDIA Corp." }).click();
  await page.getByLabel("Risk stop", { exact: true }).fill("139");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/history");
  await expect(
    page.getByRole("cell", { name: "TSLA", exact: true }),
  ).toBeVisible();
  await page.getByRole("cell", { name: "TSLA", exact: true }).click();
  await expect(
    page.getByText("Saqlanganda P&L", { exact: true }),
  ).toBeVisible();
  await page.goto("/scenarios/new");
  await page.getByLabel("Nomi", { exact: true }).fill("E2E policy");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page).toHaveURL(/\/scenarios$/);
  const row = page.locator("tr").filter({ hasText: "E2E policy" });
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Faollashtirish", exact: true })
    .click();
  await expect(row.getByText("Faol", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Mavzu", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Mavzu", { exact: true }).selectOption("light");
  await page.getByRole("button", { name: "Saqlash", exact: true }).click();
  await page.getByLabel("Til", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("uz");
});
test("rejects cross origin requests and unauthorized API reads", async ({
  request,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/login", {
        headers: { Origin: "https://evil.example" },
        data: { username: "admin", password: "x" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/login", {
        headers: { Origin: origin },
        data: { username: "admin", password: "wrong" },
      })
    ).status(),
  ).toBe(401);
});
test("mobile login fits viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Kirish", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
