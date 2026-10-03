export type Fill = {
  externalId: string;
  conid: string;
  symbol: string;
  quantity: number;
  price: number;
  fees: number;
  multiplier: number;
  fx: number;
  at: Date;
  openClose: string;
};
export function matchLots(fills: Fill[]) {
  const books = new Map<string, { fill: Fill; remaining: number }[]>();
  const closed = [];
  for (const fill of [...fills].sort(
    (a, b) => +a.at - +b.at || a.externalId.localeCompare(b.externalId),
  )) {
    const book = books.get(fill.conid) ?? [];
    books.set(fill.conid, book);
    let remaining = Math.abs(fill.quantity);
    if (fill.openClose === "O") {
      book.push({ fill, remaining });
      continue;
    }
    if (fill.openClose !== "C") continue;
    for (const lot of book) {
      if (!remaining) break;
      if (
        !lot.remaining ||
        Math.sign(lot.fill.quantity) === Math.sign(fill.quantity)
      )
        continue;
      const amount = Math.min(remaining, lot.remaining);
      closed.push({
        externalId: `fifo:${lot.fill.externalId}:${fill.externalId}`,
        symbol: fill.symbol,
        conid: fill.conid,
        quantity: amount * Math.sign(lot.fill.quantity),
        entry: lot.fill.price,
        exit: fill.price,
        multiplier: fill.multiplier,
        fx: fill.fx,
        fees:
          ((lot.fill.fees * amount) / Math.abs(lot.fill.quantity) +
            (fill.fees * amount) / Math.abs(fill.quantity)) *
          fill.fx,
        openedAt: lot.fill.at,
        closedAt: fill.at,
        reason: "unknown",
      });
      remaining -= amount;
      lot.remaining -= amount;
    }
    // An unmatched close is not treated as an opening. Older entry data is required.
  }
  return closed;
}
