import "dotenv/config";
import { db } from "../server/db";
import { syncAccount, syncHistory, syncBars } from "../server/portfolio";
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
async function run() {
  while (!stopped) {
    const accounts = await db.account.findMany();
    for (const a of accounts) {
      try {
        await syncAccount(a.id);
        if (
          a.mode === "live" &&
          process.env.IBKR_FLEX_TOKEN &&
          (!a.historySyncedAt || Date.now() - +a.historySyncedAt > 6 * 3600000)
        ) {
          await syncHistory(a.id);
          await syncBars(a.id);
        }
      } catch {
        console.error(`Sync failed for account ${a.id}`);
      }
    }
    await new Promise((r) =>
      setTimeout(r, Number(process.env.WORKER_INTERVAL_MS ?? 60000)),
    );
  }
  await db.$disconnect();
}
run().catch(() => {
  console.error("Worker failed");
  process.exitCode = 1;
});
