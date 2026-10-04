import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { Fill } from "./lots";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  processEntities: false,
  isArray: (name) => ["FlexStatement", "Trade"].includes(name),
});
const num = z.coerce.number().finite();
const fillSchema = z.object({
  accountId: z.string(),
  tradeID: z.string().min(1),
  conid: z.string(),
  symbol: z.string(),
  quantity: num.refine((v) => v !== 0),
  tradePrice: num.positive(),
  ibCommission: num,
  currency: z.string().optional(),
  ibCommissionCurrency: z.string().optional(),
  multiplier: num.positive(),
  fxRateToBase: num.positive(),
  dateTime: z.string(),
  openCloseIndicator: z.enum(["O", "C"]),
  levelOfDetail: z.string(),
});
function parse(xml: string) {
  if (xml.length > 10_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("Unsafe or oversized Flex XML");
  return parser.parse(xml);
}
export function parseFlex(
  xml: string,
  accountId: string,
  baseCurrency?: string,
): Fill[] {
  const doc = parse(xml);
  const statements = doc.FlexQueryResponse?.FlexStatements?.FlexStatement;
  if (!Array.isArray(statements)) throw Error("Invalid Flex statement");
  const fills: Fill[] = [];
  for (const statement of statements) {
    if (statement.accountId !== accountId) continue;
    for (const trade of statement.Trades?.Trade ?? []) {
      if (trade.levelOfDetail !== "EXECUTION") continue;
      const v = fillSchema.parse({ ...trade, accountId: statement.accountId });
      const at = /^(\d{4})(\d{2})(\d{2});(\d{2})(\d{2})(\d{2})$/.exec(
        v.dateTime,
      );
      if (!at) throw Error("Configure Flex dates as yyyyMMdd;HHmmss in UTC");
      fills.push({
        externalId: v.tradeID,
        conid: v.conid,
        symbol: v.symbol,
        currency: v.currency ?? null,
        quantity: v.quantity,
        price: v.tradePrice,
        fees: -v.ibCommission,
        feeCurrency: v.ibCommissionCurrency || null,
        feeFx:
          v.ibCommissionCurrency && v.ibCommissionCurrency === baseCurrency
            ? 1
            : v.ibCommissionCurrency && v.ibCommissionCurrency === v.currency
              ? v.fxRateToBase
              : null,
        multiplier: v.multiplier,
        fx: v.fxRateToBase,
        at: new Date(`${at[1]}-${at[2]}-${at[3]}T${at[4]}:${at[5]}:${at[6]}Z`),
        openClose: v.openCloseIndicator,
      });
    }
  }
  return fills;
}
export async function fetchFlex(accountId: string, baseCurrency?: string) {
  const token = process.env.IBKR_FLEX_TOKEN,
    query = process.env.IBKR_FLEX_QUERY_ID;
  if (!token || !query) throw Error("Configure IBKR Flex token and query ID");
  const base =
    "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
  async function get(path: string, params: Record<string, string>) {
    const r = await fetch(
      `${base}/${path}?${new URLSearchParams({ ...params, t: token!, v: "3" })}`,
      { signal: AbortSignal.timeout(20000), cache: "no-store" },
    ).catch(() => {
      throw Error("Flex request failed");
    });
    if (!r.ok) throw Error(`Flex HTTP ${r.status}`);
    return r.text();
  }
  const result = parse(
    await get("SendRequest", { q: query }),
  ).FlexStatementResponse;
  if (result?.Status !== "Success")
    throw Error("Flex report generation failed");
  const reference = String(result.ReferenceCode);
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const xml = await get("GetStatement", { q: reference });
    const response = parse(xml);
    if (response.FlexQueryResponse)
      return parseFlex(xml, accountId, baseCurrency);
    if (
      !["1019", "1009"].includes(
        String(response.FlexStatementResponse?.ErrorCode),
      )
    )
      throw Error("Flex report retrieval failed");
  }
  throw Error("Flex report not ready; retry later");
}
