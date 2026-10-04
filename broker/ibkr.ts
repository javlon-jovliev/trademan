import type { BrokerAdapter, BrokerSnapshot, BrokerPosition } from "./types";
import { z } from "zod";
const number = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?[\d.]+$/)
      .transform(Number),
  ])
  .pipe(z.number().finite());
const position = z.object({
  conid: z.union([z.number(), z.string()]),
  contractDesc: z.string(),
  position: number,
  avgCost: number,
  avgPrice: number.optional(),
  ticker: z.string().optional(),
  name: z.string().optional(),
  mktPrice: number.nullish(),
  currency: z.string(),
  assetClass: z.string(),
  multiplier: number.optional(),
});
export class IBKRAdapter implements BrokerAdapter {
  private readonly base: string;
  constructor() {
    const url = process.env.IBKR_GATEWAY_URL;
    if (!url) throw Error("IBKR gateway is not configured");
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "ibkr-gateway"].includes(parsed.hostname)
      )
    )
      throw Error("IBKR requires HTTPS");
    this.base = url.replace(/\/$/, "");
  }
  private async get(path: string): Promise<unknown> {
    const isAuth = path === "/iserver/auth/status";
    const r = await fetch(`${this.base}${path}`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      method: isAuth ? "POST" : "GET",
      headers: {
        "User-Agent": "ERTA/1.0",
        ...(isAuth ? { "Content-Type": "application/json" } : {}),
      },
      ...(isAuth ? { body: "{}" } : {}),
    });
    if (!r.ok) throw Error(`IBKR HTTP ${r.status}`);
    return r.json();
  }
  async keepAlive() {
    // Gateway keep-alive does not authenticate, switch accounts or modify orders.
    await this.get("/tickle");
  }
  async connectionStatus() {
    const auth = z
      .object({ authenticated: z.boolean(), connected: z.boolean() })
      .parse(await this.get("/iserver/auth/status"));
    return auth.authenticated && auth.connected;
  }
  async quotes(accountId: string, positionConids: string[]) {
    // Do not switch the Gateway's active account or submit/modify orders.
    await this.get("/iserver/accounts");
    const response = z
      .object({
        orders: z.array(
          z.object({
            acct: z.string(),
            conid: z.union([z.string(), z.number()]),
            remainingQuantity: number,
          }),
        ),
      })
      .parse(await this.get("/iserver/account/orders"));
    const conids = [
      ...new Set([
        ...positionConids,
        ...response.orders
          .filter((o) => o.acct === accountId && o.remainingQuantity > 0)
          .map((o) => String(o.conid)),
      ]),
    ].filter((id) => /^\d+$/.test(id));
    const quotes: {
      conid: string;
      bid: number;
      ask: number;
      at: Date;
      observedAt: Date;
    }[] = [];
    for (let offset = 0; offset < conids.length; offset += 50) {
      const ids = conids.slice(offset, offset + 50);
      const raw = z
        .array(z.record(z.string(), z.unknown()))
        .parse(
          await this.get(
            `/iserver/marketdata/snapshot?${new URLSearchParams({ conids: ids.join(","), fields: "84,86,6509" })}`,
          ),
        );
      const observedAt = new Date();
      for (const q of raw) {
        const conid = String(q.conid),
          bid = Number(q["84"]),
          ask = Number(q["86"]),
          at = new Date(Number(q._updated));
        if (
          ids.includes(conid) &&
          String(q["6509"]).startsWith("R") &&
          bid > 0 &&
          ask >= bid &&
          Number.isFinite(ask) &&
          Number.isFinite(+at) &&
          +at <= +observedAt &&
          +observedAt - +at <= 15000
        )
          quotes.push({ conid, bid, ask, at, observedAt });
      }
      // The initial pre-flight response may contain no prices. The next polling cycle retries it.
    }
    return quotes;
  }
  async history(conid: string, options: { from?: Date; to?: Date } = {}) {
    if (!/^\d+$/.test(conid)) throw Error("Invalid contract ID");
    const cursor = new Date(options.to ?? new Date());
    const fallback = new Date(cursor);
    fallback.setUTCFullYear(fallback.getUTCFullYear() - 1);
    const from = options.from ?? fallback;
    if (!Number.isFinite(+cursor) || !Number.isFinite(+from))
      throw Error("Invalid historical date range");
    const bars = new Map<
      string,
      { time: string; open: number; high: number; low: number; close: number }
    >();
    // Annual windows stay below IBKR's 1000-point response cap for daily bars.
    for (let page = 0; page < 15 && cursor > from; page++) {
      const startTime = cursor
        .toISOString()
        .slice(0, 19)
        .replaceAll("-", "")
        .replace("T", "-");
      const response = z
        .object({
          data: z.array(
            z.object({ t: number, o: number, h: number, l: number, c: number }),
          ),
        })
        .parse(
          await this.get(
            `/iserver/marketdata/history?${new URLSearchParams({ conid, period: "1y", bar: "1d", outsideRth: "false", startTime, direction: "-1" })}`,
          ),
        );
      for (const b of response.data) {
        const at = new Date(b.t);
        if (
          !Number.isFinite(+at) ||
          at > (options.to ?? new Date()) ||
          b.h < Math.max(b.o, b.c, b.l) ||
          b.l > Math.min(b.o, b.c)
        )
          throw Error("Invalid historical price data");
        const time = at.toISOString().slice(0, 10);
        bars.set(time, { time, open: b.o, high: b.h, low: b.l, close: b.c });
      }
      cursor.setUTCFullYear(cursor.getUTCFullYear() - 1);
    }
    return [...bars.values()]
      .filter(
        (b) => new Date(b.time) >= new Date(from.toISOString().slice(0, 10)),
      )
      .sort((a, b) => a.time.localeCompare(b.time));
  }
  async snapshot(accountId: string): Promise<BrokerSnapshot> {
    if (!/^[A-Za-z0-9_-]+$/.test(accountId))
      throw Error("Invalid broker account");
    if (!(await this.connectionStatus()))
      throw Error("Authenticate the IBKR Client Portal Gateway first");
    const accounts = z
      .array(z.object({ accountId: z.string() }))
      .parse(await this.get("/portfolio/accounts"));
    if (!accounts.some((a) => a.accountId === accountId))
      throw Error("IBKR account is not accessible");
    const ledger = z
      .record(
        z.string(),
        z.object({
          netliquidationvalue: number.nullish(),
          cashbalance: number.nullish(),
          exchangerate: number.nullish(),
        }),
      )
      .parse(await this.get(`/portfolio/${accountId}/ledger`));
    const summary = z
      .record(
        z.string(),
        z.object({ amount: number.nullish(), currency: z.string().nullish() }),
      )
      .parse(await this.get(`/portfolio/${accountId}/summary`));
    const base = ledger.BASE;
    const currency = summary.netliquidation?.currency ?? "USD";
    const positions: BrokerPosition[] = [];
    for (let page = 0; page < 100; page++) {
      const raw = z
        .array(position)
        .parse(await this.get(`/portfolio/${accountId}/positions/${page}`));
      for (const p of raw) {
        const mult =
          p.multiplier && p.multiplier > 0
            ? p.multiplier
            : ["STK", "CASH", "CRYPTO"].includes(p.assetClass)
              ? 1
              : null;
        if (mult === null)
          throw Error(
            "Missing derivative multiplier; refusing an inaccurate sync",
          );
        positions.push({
          conid: String(p.conid),
          symbol: p.ticker ?? p.contractDesc,
          name: p.name ?? p.contractDesc,
          quantity: p.position,
          averagePrice: p.avgPrice ?? p.avgCost / mult,
          currentPrice: p.mktPrice ?? null,
          previousClose: null,
          multiplier: mult,
          fx:
            p.currency === currency
              ? 1
              : (ledger[p.currency]?.exchangerate ?? null),
          currency: p.currency,
          assetClass: p.assetClass,
          sector: "Unknown",
        });
      }
      if (raw.length < 100) break;
      if (page === 99) throw Error("Position pagination limit reached");
    }
    return {
      brokerId: accountId,
      currency,
      nlv: summary.netliquidation?.amount ?? base?.netliquidationvalue ?? null,
      cash: base?.cashbalance ?? null,
      buyingPower: summary.buyingpower?.amount ?? null,
      maintenanceMargin: summary.maintmarginreq?.amount ?? null,
      excessLiquidity: summary.excessliquidity?.amount ?? null,
      positions,
    };
  }
}
