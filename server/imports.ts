import { z } from "zod";
// Quoted RFC4180 fields, escaped quotes, CRLF and embedded line breaks.
export function parseCSV(text: string) {
  if (text.length > 2_000_000) throw Error("CSV exceeds 2 MB");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers || new Set(headers).size !== headers.length)
    throw Error("Invalid CSV headers");
  if (rows.length > 5000) throw Error("Maximum 5000 rows");
  return rows.map((r) => {
    if (r.length !== headers.length) throw Error("CSV column count mismatch");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), r[i].trim()]));
  });
}
const finite = z.coerce.number().finite();
export const tradeImport = z
  .object({
    symbol: z.string().min(1).max(80),
    quantity: finite.refine((n) => n !== 0),
    entry: finite.positive(),
    exit: finite.positive(),
    openedAt: z.iso.datetime({ offset: true }),
    closedAt: z.iso.datetime({ offset: true }),
    reason: z.enum(["stop_loss", "take_profit", "manual", "unknown"]),
    fees: finite.nonnegative(),
    externalId: z.string().min(1).max(120),
    multiplier: finite.positive().default(1),
    fx: finite.positive().default(1),
  })
  .refine(
    (t) => new Date(t.openedAt) < new Date(t.closedAt),
    "Close must follow entry",
  );
export const barImport = z
  .object({
    symbol: z.string().min(1),
    time: z.iso.date(),
    open: finite.positive(),
    high: finite.positive(),
    low: finite.positive(),
    close: finite.positive(),
  })
  .refine(
    (b) =>
      b.high >= Math.max(b.open, b.close) &&
      b.low <= Math.min(b.open, b.close) &&
      b.high >= b.low,
    "Invalid OHLC",
  );
