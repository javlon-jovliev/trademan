import { hash, argon2id } from "argon2";
import { db, demoMode } from "../server/db";
import { refreshAlerts } from "../server/portfolio";
async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw Error("Set SEED_PASSWORD with at least 12 characters");
  const username = process.env.SEED_USERNAME ?? "admin";
  const user = await db.user.upsert({
    where: { username },
    create: {
      username,
      email: process.env.SEED_EMAIL ?? "admin@example.test",
      passwordHash: await hash(password, { type: argon2id }),
    },
    update: {},
  });
  if (!demoMode()) return;
  const account = await db.account.upsert({
    where: {
      userId_brokerId_mode: {
        userId: user.id,
        brokerId: "DU1234567",
        mode: "demo",
      },
    },
    create: {
      userId: user.id,
      brokerId: "DU1234567",
      mode: "demo",
      nlv: 102430,
      cash: 54390,
      buyingPower: 152800,
      maintenanceMargin: 19800,
      excessLiquidity: 82630,
      connected: true,
      syncedAt: new Date(),
    },
    update: {},
  });
  if (await db.position.count({ where: { accountId: account.id } })) {
    await ensureDemoExecutions(account.id);
    return;
  }
  const scenario = await db.scenario.create({
    data: {
      accountId: account.id,
      name: "Konservativ",
      description: "Kapitalni saqlash",
      sectorLimits: { Technology: 35, Healthcare: 25 },
      assetLimits: { STK: 90 },
    },
  });
  await db.account.update({
    where: { id: account.id },
    data: { activeScenarioId: scenario.id },
  });
  await db.scenario.create({
    data: {
      accountId: account.id,
      name: "Muvozanatli",
      maxHeat: 8,
      warningHeat: 6,
      maxTradeRisk: 2,
      maxPosition: 30,
      sectorLimit: 45,
    },
  });
  const assets = [
    ["NVDA", "NVIDIA Corp.", 100, 142.5, 151.2, 149.1, 138, "Technology"],
    ["AAPL", "Apple Inc.", 60, 223.2, 228.5, 230, 213, "Technology"],
    ["MSFT", "Microsoft Corp.", 30, 495, 510, 506, 475, "Technology"],
    ["JNJ", "Johnson & Johnson", 50, 164, 168, 169, 155, "Healthcare"],
    ["XOM", "Exxon Mobil", -40, 115, 112.25, 111, 121, "Energy"],
  ] as const;
  for (const [
    symbol,
    name,
    quantity,
    averagePrice,
    currentPrice,
    previousClose,
    riskStop,
    sector,
  ] of assets)
    await db.position.create({
      data: {
        accountId: account.id,
        conid: symbol,
        symbol,
        name,
        quantity,
        averagePrice,
        currentPrice,
        previousClose,
        riskStop,
        sector,
        fx: 1,
      },
    });
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  for (let i = 100; i >= 0; i--) {
    const at = new Date(+today - i * 86400000);
    const nlv = 98000 + (100 - i) * 44.3 + Math.sin(i / 6) * 750;
    await db.snapshot.create({
      data: { accountId: account.id, at, nlv: i === 0 ? 102430 : nlv },
    });
  }
  for (const [i, symbol] of ["TSLA", "AMD", "META"].entries()) {
    const closedAt = new Date(+today - (12 + i * 10) * 86400000);
    const openedAt = new Date(+closedAt - 14 * 86400000);
    const entry = 200 + i * 50;
    const exit = entry + (i === 1 ? -14 : 22);
    const bars = [];
    for (let d = 0; d <= Math.floor((+today - +openedAt) / 86400000); d++) {
      const at = new Date(+openedAt + d * 86400000);
      const price = entry + d * 0.8 + Math.sin(d / 3) * 8;
      bars.push({
        time: at.toISOString().slice(0, 10),
        open: price - 1,
        high: price + 4,
        low: price - 4,
        close: price + 1,
      });
    }
    await db.trade.create({
      data: {
        accountId: account.id,
        externalId: `demo-${i}`,
        symbol,
        quantity: 20,
        entry,
        exit,
        fees: 2,
        openedAt,
        closedAt,
        reason: ["take_profit", "stop_loss", "manual"][i],
        bars,
      },
    });
  }
  await ensureDemoExecutions(account.id);
  await refreshAlerts(account.id);
}
async function ensureDemoExecutions(accountId: string) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    include: { positions: true, trades: true },
  });
  if (!demoMode() || account.mode !== "demo") return;
  const at = new Date(Date.now() - 10 * 86400000);
  for (const p of account.positions) {
    const externalId = `demo-position-${p.id}`;
    await db.execution.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      update: {},
      create: {
        accountId,
        externalId,
        conid: p.conid,
        symbol: p.symbol,
        quantity: p.quantity,
        price: p.averagePrice,
        fees: 1,
        currency: account.currency,
        feeCurrency: account.currency,
        feeFx: 1,
        multiplier: p.multiplier,
        fx: p.fx ?? 1,
        at,
        openClose: "O",
        benchmarkPrice: p.averagePrice - Math.sign(p.quantity) * 0.05,
        benchmarkAt: new Date(+at - 10000),
      },
    });
  }
  for (const trade of account.trades.filter((t) =>
    t.externalId.startsWith("demo-"),
  )) {
    const conid = trade.conid ?? trade.symbol;
    const entryFee = trade.fees / 2,
      exitFee = trade.fees / 2;
    for (const [leg, quantity, price, at, fees, openClose] of [
      ["entry", trade.quantity, trade.entry, trade.openedAt, entryFee, "O"],
      ["exit", -trade.quantity, trade.exit, trade.closedAt, exitFee, "C"],
    ] as const) {
      const externalId = `${trade.externalId}-${leg}`;
      await db.execution.upsert({
        where: { accountId_externalId: { accountId, externalId } },
        update: {},
        create: {
          accountId,
          externalId,
          conid,
          symbol: trade.symbol,
          quantity,
          price,
          fees,
          currency: account.currency,
          feeCurrency: account.currency,
          feeFx: 1,
          multiplier: trade.multiplier,
          fx: trade.fx,
          at,
          openClose,
          benchmarkPrice: price - Math.sign(quantity) * 0.03,
          benchmarkAt: new Date(+at - 10000),
        },
      });
    }
    await db.trade.update({
      where: { id: trade.id },
      data: {
        conid,
        currency: account.currency,
        entryFee,
        exitFee,
        feesKnown: true,
        slippage: Math.abs(trade.quantity) * 0.06 * trade.multiplier * trade.fx,
        slippageCoverage: 100,
      },
    });
  }
}
main().finally(() => db.$disconnect());
