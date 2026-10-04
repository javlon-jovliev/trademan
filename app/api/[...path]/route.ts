import { NextRequest, NextResponse } from "next/server";
import { hash, verify, argon2id } from "argon2";
import { z, ZodError } from "zod";
import {
  currentUser,
  issueSession,
  loginAllowed,
  logoutSession,
  sessionDigest,
} from "@/server/auth";
import { db, demoMode } from "@/server/db";
import {
  accountFor,
  refreshAlerts,
  syncAccount,
  syncHistory,
  syncBars,
} from "@/server/portfolio";
import { scenarioSchema } from "@/server/validation";
import { sendTelegram } from "@/notifications/telegram";
import { evaluate } from "@/risk/engine";
import { executionCosts } from "@/risk/costs";
import { parseCSV, tradeImport, barImport } from "@/server/imports";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (req.nextUrl.pathname !== "/api/state")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await accountFor(user.id);
  const policy =
    account?.scenarios.find((s) => s.id === account.activeScenarioId) ?? null;
  const stale =
    account?.mode === "live" &&
    (!account.connected ||
      !account.syncedAt ||
      Date.now() - +account.syncedAt > 180000);
  const usable = account && !stale ? account : null;
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      language: user.language,
      theme: user.theme,
      timezone: user.timezone,
      baseCurrency: user.baseCurrency,
      collapsed: user.collapsed,
      telegramEnabled: user.telegramEnabled,
      telegramChatId: user.telegramChatId,
    },
    account: account
      ? {
          ...account,
          ...(stale
            ? {
                nlv: null,
                cash: null,
                buyingPower: null,
                maintenanceMargin: null,
                excessLiquidity: null,
              }
            : {}),
          positions: undefined,
          executions: undefined,
        }
      : null,
    risk: usable
      ? evaluate(usable.positions, usable, policy, usable.snapshots)
      : null,
    demo: demoMode(),
    stale: Boolean(stale),
    costs: account ? executionCosts(account.executions, account.positions, usable?.nlv ?? null) : null,
    path: req.nextUrl.pathname,
  });
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const origin = req.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const route = (await ctx.params).path.join("/");
    const body = await req.json();
    if (route === "login") {
      const input = z
        .object({
          username: z.string().min(1).max(80),
          password: z.string().min(1).max(256),
        })
        .parse(body);
      if (!(await loginAllowed(input.username)))
        return NextResponse.json(
          { error: "Too many attempts. Retry in 15 minutes." },
          { status: 429 },
        );
      const user = await db.user.findUnique({
        where: { username: input.username },
      });
      if (!user || !(await verify(user.passwordHash, input.password)))
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 },
        );
      await db.loginAttempt.deleteMany({
        where: { key: sessionDigest(input.username.toLowerCase()) },
      });
      await issueSession(user.id);
      return NextResponse.json({ ok: true });
    }
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (route === "logout") {
      await logoutSession();
      return NextResponse.json({ ok: true });
    }
    if (route === "settings") {
      const input = z
        .object({
          username: z.string().trim().min(2).max(80),
          email: z.email(),
          language: z.enum(["uz", "en"]),
          theme: z.enum(["light", "dark", "system"]),
          timezone: z.string().refine((v) => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }),
          baseCurrency: z.enum(["USD", "EUR", "GBP"]),
          collapsed: z.boolean(),
          telegramEnabled: z.boolean(),
          telegramChatId: z.string().regex(/^-?\d+$|^$/),
        })
        .parse(body);
      await db.user.update({ where: { id: user.id }, data: input });
      return NextResponse.json({ ok: true });
    }
    if (route === "password") {
      const input = z
        .object({ current: z.string(), password: z.string().min(12).max(256) })
        .parse(body);
      if (!(await verify(user.passwordHash, input.current)))
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 400 },
        );
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await hash(input.password, { type: argon2id }),
          },
        }),
        db.session.deleteMany({ where: { userId: user.id } }),
      ]);
      await issueSession(user.id);
      return NextResponse.json({ ok: true });
    }
    if (route === "sessions/revoke") {
      const token = req.cookies.get("erta_session")?.value;
      if (!token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      await db.session.deleteMany({
        where: { userId: user.id, id: { not: sessionDigest(token) } },
      });
      return NextResponse.json({ ok: true });
    }
    if (route === "telegram/test") {
      if (!user.telegramChatId) throw Error("Telegram chat ID is required");
      await sendTelegram(user.telegramChatId, "ERTA: Telegram connection test");
      return NextResponse.json({ ok: true });
    }
    if (route === "connections/add") {
      if (demoMode())
        throw Error("Disable demo mode to connect a live account");
      const brokerId = z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .parse(body.brokerId);
      if (brokerId !== process.env.IBKR_ACCOUNT_ID)
        throw Error("Account must match the server IBKR_ACCOUNT_ID");
      await db.account.upsert({
        where: {
          userId_brokerId_mode: { userId: user.id, brokerId, mode: "live" },
        },
        create: { userId: user.id, brokerId, mode: "live" },
        update: {},
      });
      return NextResponse.json({ ok: true });
    }
    const account = await accountFor(user.id);
    if (!account) throw Error("Connect an account first");
    if (route === "history/bars-sync") {
      await syncBars(account.id);
      return NextResponse.json({ ok: true });
    }
    if (route === "history/sync") {
      await syncHistory(account.id);
      return NextResponse.json({ ok: true });
    }
    if (route === "sync") {
      await syncAccount(account.id);
      return NextResponse.json({ ok: true });
    }
    if (route === "connections/delete") {
      if (account.mode === "demo")
        throw Error("Demo account cannot be removed");
      await db.account.delete({ where: { id: account.id } });
      return NextResponse.json({ ok: true });
    }
    if (route === "history/import") {
      const trades = parseCSV(z.string().parse(body.csv)).map((r) =>
        tradeImport.parse(r),
      );
      await db.$transaction(
        trades.map((tr) =>
          db.trade.upsert({
            where: {
              accountId_externalId: {
                accountId: account.id,
                externalId: tr.externalId,
              },
            },
            create: {
              ...tr,
              accountId: account.id,
              openedAt: new Date(tr.openedAt),
              closedAt: new Date(tr.closedAt),
            },
            update: {
              ...tr,
              openedAt: new Date(tr.openedAt),
              closedAt: new Date(tr.closedAt),
            },
          }),
        ),
      );
    } else if (route === "history/bars") {
      const bars = parseCSV(z.string().parse(body.csv)).map((r) =>
        barImport.parse(r),
      );
      const trades = await db.trade.findMany({
        where: { accountId: account.id },
      });
      await db.$transaction(
        trades
          .filter((tr) => bars.some((b) => b.symbol === tr.symbol))
          .map((tr) =>
            db.trade.update({
              where: { id: tr.id },
              data: {
                bars: bars
                  .filter((b) => b.symbol === tr.symbol)
                  .map(({ symbol, ...b }) => {
                    void symbol;
                    return b;
                  })
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .filter((b, i, a) => i === 0 || a[i - 1].time !== b.time),
              },
            }),
          ),
      );
    } else if (route === "account/flow") {
      if (account.mode === "demo" || !account.nlv)
        throw Error("Live equity is required");
      const amount = z.coerce
        .number()
        .finite()
        .refine((n) => n !== 0)
        .parse(body.amount);
      await db.snapshot.create({
        data: {
          accountId: account.id,
          at: new Date(),
          nlv: account.nlv,
          externalFlow: amount,
        },
      });
    } else if (route === "position/stop") {
      const id = z.string().parse(body.id);
      const riskStop =
        body.riskStop === null
          ? null
          : z.coerce.number().finite().positive().parse(body.riskStop);
      const result = await db.position.updateMany({
        where: { id, accountId: account.id },
        data: {
          riskStop,
          ...(body.sector === undefined
            ? {}
            : { sector: z.string().trim().min(1).max(60).parse(body.sector) }),
        },
      });
      if (!result.count) throw Error("Position not found");
    } else if (route === "scenario/save") {
      const input = scenarioSchema.parse(body.scenario);
      if (body.id) {
        if (input.draft && account.activeScenarioId === body.id)
          throw Error("Active scenario cannot be a draft");
        const result = await db.scenario.updateMany({
          where: { id: z.string().parse(body.id), accountId: account.id },
          data: input,
        });
        if (!result.count) throw Error("Scenario not found");
      } else
        await db.scenario.create({ data: { ...input, accountId: account.id } });
    } else if (
      ["scenario/activate", "scenario/delete", "scenario/duplicate"].includes(
        route,
      )
    ) {
      const id = z.string().parse(body.id);
      const s = await db.scenario.findFirst({
        where: { id, accountId: account.id },
      });
      if (!s) throw Error("Scenario not found");
      if (route === "scenario/activate") {
        if (s.draft) throw Error("Draft scenario cannot be activated");
        await db.account.update({
          where: { id: account.id },
          data: { activeScenarioId: id },
        });
      } else if (route === "scenario/delete") {
        if (account.activeScenarioId === id)
          throw Error("Switch the active scenario before deleting it");
        await db.scenario.delete({ where: { id } });
      } else {
        const { id: oldId, updatedAt, ...copy } = s;
        void oldId;
        void updatedAt;
        await db.scenario.create({
          data: {
            ...copy,
            sectorLimits: copy.sectorLimits ?? {},
            assetLimits: copy.assetLimits ?? {},
            name: `${s.name} (copy)`,
            draft: true,
          },
        });
      }
    } else if (route === "alert/ack") {
      await db.alert.updateMany({
        where: { id: z.string().parse(body.id), accountId: account.id },
        data: { acknowledged: true },
      });
    } else if (route === "trade/notes") {
      await db.trade.updateMany({
        where: { id: z.string().parse(body.id), accountId: account.id },
        data: {
          notes: z.string().max(5000).parse(body.notes),
          ...(body.reason === undefined
            ? {}
            : {
                reason: z
                  .enum(["stop_loss", "take_profit", "manual", "unknown"])
                  .parse(body.reason),
              }),
        },
      });
    } else return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.audit.create({
      data: { userId: user.id, action: route, detail: account.id },
    });
    await refreshAlerts(account.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name.startsWith("Prisma"))
      return NextResponse.json(
        { error: "Database operation failed. Check unique fields and retry." },
        { status: 400 },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}
