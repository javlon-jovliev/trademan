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
    const r = await fetch(`${this.base}${path}`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      method: path === "/iserver/auth/status" ? "POST" : "GET",
    });
    if (!r.ok) throw Error(`IBKR HTTP ${r.status}`);
    return r.json();
  }
  async history(conid: string) {
    if (!/^\d+$/.test(conid)) throw Error("Invalid contract ID");
    const response = z
      .object({
        data: z.array(
          z.object({ t: number, o: number, h: number, l: number, c: number }),
        ),
      })
      .parse(
        await this.get(
          `/iserver/marketdata/history?${new URLSearchParams({ conid, period: "1y", bar: "1d", outsideRth: "false" })}`,
        ),
      );
    return response.data
      .map((b) => ({
        time: new Date(b.t).toISOString().slice(0, 10),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter((b, i, a) => i === 0 || b.time !== a[i - 1].time);
  }
  async snapshot(accountId: string): Promise<BrokerSnapshot> {
    if (!/^[A-Za-z0-9_-]+$/.test(accountId))
      throw Error("Invalid broker account");
    const auth = z
      .object({ authenticated: z.boolean(), connected: z.boolean() })
      .parse(await this.get("/iserver/auth/status"));
    if (!auth.authenticated || !auth.connected)
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
        z.object({ amount: number.nullish(), currency: z.string().optional() }),
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
