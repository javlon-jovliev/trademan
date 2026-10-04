import "dotenv/config";
import { db } from "../server/db";
import {
  syncAccount,
  syncHistory,
  syncBars,
  syncQuotes,
} from "../server/portfolio";
let stopped = false;
const historyAttempts = new Map<string, number>();
const barsAttempts = new Map<string, number>();
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
      } catch {
        console.error(`Broker sync failed for account ${a.id}`);
      }
      if (a.mode !== "live") continue;
      const now = Date.now();
      let historyChanged = false;
      if (
        (!a.historySyncedAt || now - +a.historySyncedAt > 6 * 3600000) &&
        now - (historyAttempts.get(a.id) ?? 0) > 15 * 60000
      ) {
        historyAttempts.set(a.id, now);
        try {
          await syncHistory(a.id);
          historyChanged = true;
        } catch {
          console.error(`History sync failed for account ${a.id}`);
        }
      }
      // Candle retries are independent of Flex availability and report completion.
      if (
        (historyChanged ||
          !a.barsSyncedAt ||
          now - +a.barsSyncedAt > 6 * 3600000) &&
        now - (barsAttempts.get(a.id) ?? 0) > 15 * 60000
      ) {
        barsAttempts.set(a.id, now);
        try {
          await syncBars(a.id);
        } catch {
          console.error(`Historical prices sync failed for account ${a.id}`);
        }
      }
    }
    await new Promise((r) =>
      setTimeout(r, Number(process.env.WORKER_INTERVAL_MS ?? 60000)),
    );
  }
}
async function quotesLoop() {
  let cleanupAt = 0;
  const errors = new Map<string, number>();
  while (!stopped) {
    const accounts = await db.account.findMany({
      where: { mode: "live" },
      select: { id: true },
    });
    for (const account of accounts) {
      try {
        await syncQuotes(account.id);
      } catch {
        if (Date.now() - (errors.get(account.id) ?? 0) > 60000) {
          errors.set(account.id, Date.now());
          console.error(
            `Quote capture unavailable for account ${account.id}; retrying automatically`,
          );
        }
      }
    }
    if (Date.now() - cleanupAt > 3600000) {
      await db.marketQuote.deleteMany({
        where: { observedAt: { lt: new Date(Date.now() - 14 * 86400000) } },
      });
      cleanupAt = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
Promise.all([run(), quotesLoop()])
  .finally(() => db.$disconnect())
  .catch(() => {
    stopped = true;
    console.error("Worker failed");
    process.exitCode = 1;
  });
