import { z } from "zod";
import type { BrokerAdapter, BrokerSnapshot } from "./types";
const finite = z.number().finite();
const nullable = finite.nullable();
const snapshotSchema = z.object({
  brokerId: z.string(),
  currency: z.string().min(1),
  nlv: nullable,
  cash: nullable,
  buyingPower: nullable,
  maintenanceMargin: nullable,
  excessLiquidity: nullable,
  positions: z.array(
    z.object({
      conid: z.string().regex(/^\d+$/),
      symbol: z.string(),
      name: z.string(),
      quantity: finite,
      averagePrice: finite,
      currentPrice: nullable,
      previousClose: nullable,
      multiplier: finite.positive(),
      fx: finite.positive().nullable(),
      currency: z.string(),
      assetClass: z.string(),
      sector: z.string(),
    }),
  ),
});
const barsSchema = z.array(
  z
    .object({
      time: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      open: finite,
      high: finite,
      low: finite,
      close: finite,
    })
    .refine(
      (b) =>
        b.high >= Math.max(b.open, b.close, b.low) &&
        b.low <= Math.min(b.open, b.close),
    ),
);
const quotesSchema = z.array(
  z.object({
    conid: z.string(),
    bid: finite.positive(),
    ask: finite.positive(),
    at: z.coerce.date(),
    observedAt: z.coerce.date(),
  }),
);
export class TWSAdapter implements BrokerAdapter {
  private readonly base: string;
  constructor() {
    const url = new URL(
      process.env.IBKR_TWS_BRIDGE_URL ?? "http://127.0.0.1:8000",
    );
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "tws-bridge"].includes(url.hostname))
      )
    )
      throw Error("TWS bridge requires HTTPS or a trusted local host");
    this.base = url.href.replace(/\/$/, "");
    if (!process.env.IBKR_TWS_BRIDGE_TOKEN)
      throw Error("Configure IBKR_TWS_BRIDGE_TOKEN");
  }
  private async request(path: string, body: unknown = {}) {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.IBKR_TWS_BRIDGE_TOKEN}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw Error(
        "TWS bridge unavailable; check IB Gateway login and API settings",
      );
    }
    if (!response.ok)
      throw Error(
        `TWS bridge HTTP ${response.status}; check Gateway login, account and data permissions`,
      );
    return response.json();
  }
  async connectionStatus() {
    return z
      .object({ connected: z.boolean() })
      .parse(await this.request("/status")).connected;
  }
  async keepAlive() {
    if (!(await this.connectionStatus()))
      throw Error("IB Gateway disconnected");
  }
  async snapshot(accountId: string): Promise<BrokerSnapshot> {
    const snapshot = snapshotSchema.parse(
      await this.request("/snapshot", { accountId }),
    );
    if (
      snapshot.brokerId !== accountId ||
      new Set(snapshot.positions.map((p) => p.conid)).size !==
        snapshot.positions.length
    )
      throw Error("TWS account or positions mismatch; refusing sync");
    return snapshot;
  }
  async quotes(accountId: string, conids: string[]) {
    const quotes = quotesSchema.parse(
      await this.request("/quotes", { accountId, conids }),
    );
    const now = Date.now();
    return quotes.filter(
      (q) =>
        q.ask >= q.bid &&
        +q.at <= +q.observedAt &&
        +q.observedAt <= now &&
        now - +q.at <= 15000,
    );
  }
  async history(conid: string, options: { from?: Date; to?: Date } = {}) {
    if (!/^\d+$/.test(conid)) throw Error("Invalid contract ID");
    const to = options.to ?? new Date();
    const from = options.from ?? new Date(+to - 365 * 86400000);
    if (!Number.isFinite(+to) || !Number.isFinite(+from))
      throw Error("Invalid historical date range");
    const cursor = new Date(to);
    const bars = new Map<string, z.infer<typeof barsSchema>[number]>();
    for (let page = 0; cursor > from; page++) {
      if (page === 15) throw Error("Historical range exceeds 15 years");
      for (const bar of barsSchema.parse(
        await this.request("/history", { conid, to: cursor.toISOString() }),
      )) {
        const at = new Date(bar.time);
        if (!Number.isFinite(+at) || at > to)
          throw Error("Invalid historical price data");
        if (at >= new Date(from.toISOString().slice(0, 10)))
          bars.set(bar.time, bar);
      }
      cursor.setUTCFullYear(cursor.getUTCFullYear() - 1);
    }
    return [...bars.values()].sort((a, b) => a.time.localeCompare(b.time));
  }
}
