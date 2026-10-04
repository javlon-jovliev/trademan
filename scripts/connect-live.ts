import { db, demoMode } from "../server/db";
import { IBKRAdapter } from "../broker/ibkr";
import { syncAccount } from "../server/portfolio";

async function main() {
  if (demoMode()) throw Error("Live connection cannot run in demo mode");
  const brokerId = process.env.IBKR_ACCOUNT_ID;
  if (!brokerId || !/^[A-Za-z0-9_-]+$/.test(brokerId))
    throw Error("Configure IBKR_ACCOUNT_ID first");
  const user = await db.user.findUniqueOrThrow({
    where: { username: process.env.SEED_USERNAME ?? "admin" },
  });
  const existing = await db.account.findUnique({
    where: {
      userId_brokerId_mode: { userId: user.id, brokerId, mode: "live" },
    },
  });
  if (!existing) {
    // Verify ownership before connecting a new account for the first time.
    await new IBKRAdapter().snapshot(brokerId);
  }
  const account =
    existing ??
    (await db.account.create({
      data: { userId: user.id, brokerId, mode: "live" },
    }));
  try {
    await syncAccount(account.id);
  } catch (error) {
    if (!existing) throw error;
    console.log(
      "Account retained; complete daily IBKR browser login to resume sync",
    );
    return;
  }
  console.log("Live account connected and synchronized");
}
main()
  .catch(() => {
    console.error(
      "Live sync failed. Check IBKR browser login and configured account.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
