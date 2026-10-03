import { db, demoMode } from "./db";
import { evaluate } from "../risk/engine";
import { IBKRAdapter } from "../broker/ibkr";
import { fetchFlex } from "../broker/flex";
import { matchLots } from "../broker/lots";
import { sendTelegram } from "../notifications/telegram";
export async function accountFor(userId: string) {
  return db.account.findFirst({
    where: { userId, mode: demoMode() ? "demo" : "live" },
    include: {
      positions: true,
      scenarios: { orderBy: { updatedAt: "desc" } },
      snapshots: { orderBy: { at: "asc" } },
      trades: { orderBy: { closedAt: "desc" } },
      alerts: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });
}
export async function refreshAlerts(accountId: string) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    include: { positions: true, snapshots: true, scenarios: true, user: true },
  });
  const policy =
    account.scenarios.find((s) => s.id === account.activeScenarioId) ?? null;
  const risk = evaluate(account.positions, account, policy, account.snapshots);
  const keys = risk.violations.map((v) => v.key);
  await db.alert.updateMany({
    where: { accountId, active: true, key: { notIn: keys } },
    data: { active: false },
  });
  if (!policy?.alertEnabled) return;
  for (const v of risk.violations) {
    let alert = await db.alert.findFirst({
      where: { accountId, key: v.key, active: true },
    });
    if (alert && alert.severity !== v.severity) {
      await db.alert.update({
        where: { id: alert.id },
        data: { active: false },
      });
      alert = null;
    }
    if (!alert)
      alert = await db.alert.create({
        data: {
          accountId,
          key: v.key,
          severity: v.severity,
          message: `${v.key}: ${v.value?.toFixed(2) ?? "unavailable"} / ${v.limit ?? "—"} (${v.severity})`,
        },
      });
    if (
      account.user.telegramEnabled &&
      account.user.telegramChatId &&
      !alert.deliveredAt &&
      !alert.acknowledged
    ) {
      try {
        await sendTelegram(
          account.user.telegramChatId,
          `ERTA · ${account.brokerId}\n${alert.message}`,
        );
        await db.alert.update({
          where: { id: alert.id },
          data: { deliveredAt: new Date(), deliveryError: null },
        });
      } catch {
        await db.alert.update({
          where: { id: alert.id },
          data: { deliveryError: "Telegram delivery failed; will retry" },
        });
      }
    }
  }
}
export async function syncAccount(id: string) {
  const account = await db.account.findUniqueOrThrow({ where: { id } });
  if (account.mode === "demo") {
    await refreshAlerts(id);
    return;
  }
  try {
    const snapshot = await new IBKRAdapter().snapshot(account.brokerId);
    await db.$transaction(async (tx) => {
      await tx.account.update({
        where: { id },
        data: {
          currency: snapshot.currency,
          nlv: snapshot.nlv,
          cash: snapshot.cash,
          buyingPower: snapshot.buyingPower,
          maintenanceMargin: snapshot.maintenanceMargin,
          excessLiquidity: snapshot.excessLiquidity,
          connected: true,
          syncError: null,
          syncedAt: new Date(),
        },
      });
      await tx.position.deleteMany({
        where: {
          accountId: id,
          conid: { notIn: snapshot.positions.map((p) => p.conid) },
        },
      });
      for (const p of snapshot.positions)
        await tx.position.upsert({
          where: { accountId_conid: { accountId: id, conid: p.conid } },
          create: { accountId: id, ...p },
          update: {
            ...p,
            sector: p.sector === "Unknown" ? undefined : p.sector,
          },
        });
      if (snapshot.nlv !== null)
        await tx.snapshot.create({
          data: { accountId: id, at: new Date(), nlv: snapshot.nlv },
        });
    });
    await refreshAlerts(id);
  } catch (error) {
    await db.account.update({
      where: { id },
      data: {
        connected: false,
        syncError:
          error instanceof Error ? error.message : "Broker sync failed",
      },
    });
    throw error;
  }
}

export async function syncHistory(accountId: string) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.mode === "demo") return;
  try {
    const fills = await fetchFlex(account.brokerId);
    await db.$transaction(
      fills.map((f) =>
        db.execution.upsert({
          where: {
            accountId_externalId: { accountId, externalId: f.externalId },
          },
          create: { accountId, ...f },
          update: f,
        }),
      ),
    );
    const all = await db.execution.findMany({ where: { accountId } });
    const trades = matchLots(all);
    await db.$transaction(
      trades.map((trade) =>
        db.trade.upsert({
          where: {
            accountId_externalId: { accountId, externalId: trade.externalId },
          },
          create: { accountId, ...trade },
          update: trade,
        }),
      ),
    );
    await db.account.update({
      where: { id: accountId },
      data: { historySyncedAt: new Date(), historyError: null },
    });
  } catch {
    await db.account.update({
      where: { id: accountId },
      data: {
        historyError:
          "Flex history sync failed; check query fields, date format and server credentials",
      },
    });
    throw Error("Flex history sync failed");
  }
}

export async function syncBars(accountId: string) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
  });
  if (account.mode === "demo") return;
  const trades = await db.trade.findMany({
    where: { accountId, conid: { not: null } },
  });
  const broker = new IBKRAdapter();
  for (const conid of [...new Set(trades.map((t) => t.conid!))]) {
    const bars = await broker.history(conid);
    await db.trade.updateMany({ where: { accountId, conid }, data: { bars } });
  }
}
