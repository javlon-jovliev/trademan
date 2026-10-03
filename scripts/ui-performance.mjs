// Run only against a disposable DEMO_MODE database. Reports never retain cookies.
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
if (process.env.DEMO_MODE !== "true")
  throw Error("Performance audit requires DEMO_MODE=true");
let server;
let browser;
try {
  try {
    await fetch(`${origin}/login`);
  } catch {
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start"],
      { stdio: "inherit" },
    );
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${origin}/login`);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw Error("Audit server did not start");
  }
  browser = await chromium.launch({ args: ["--remote-debugging-port=9222"] });
  const context = await browser.newContext();
  const response = await context.request.post(`${origin}/api/login`, {
    headers: { Origin: origin },
    data: {
      username: process.env.SEED_USERNAME ?? "admin",
      password: process.env.SEED_PASSWORD,
    },
  });
  if (!response.ok()) throw Error("Audit login failed");
  const cookie = (await context.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  await mkdir("test-results/performance", { recursive: true });
  for (const route of ["dashboard", "portfolio"]) {
    const report = await lighthouse(`${origin}/${route}`, {
      port: 9222,
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices"],
      disableStorageReset: true,
      extraHeaders: { Cookie: cookie },
    });
    if (
      !report ||
      new URL(report.lhr.finalDisplayedUrl).pathname !== `/${route}`
    )
      throw Error("Audit was redirected outside authenticated page");
    delete report.lhr.configSettings.extraHeaders;
    await writeFile(
      `test-results/performance/${route}.json`,
      JSON.stringify(report.lhr, null, 2),
    );
    const summary = Object.fromEntries(
      Object.entries(report.lhr.categories).map(([key, v]) => [
        key,
        Math.round((v.score ?? 0) * 100),
      ]),
    );
    console.log(route, JSON.stringify(summary));
  }
} finally {
  await browser?.close();
  server?.kill();
}
