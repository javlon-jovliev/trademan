export type Fill = {
  externalId: string;
  conid: string;
  symbol: string;
  currency?: string | null;
  quantity: number;
  price: number;
  fees: number;
  feeCurrency?: string | null;
  feeFx?: number | null;
  benchmarkPrice?: number | null;
  benchmarkAt?: Date | null;
  multiplier: number;
  fx: number;
  at: Date;
  openClose: string;
};
export function fillFee(fill: Fill): number | null {
  if (fill.fees === 0) return 0;
  const fx = fill.feeFx === undefined ? fill.fx : fill.feeFx;
  return fx != null && Number.isFinite(fx) && fx > 0 ? fill.fees * fx : null;
}
export function fillSlippage(fill: Fill): number | null {
  if (!fill.benchmarkPrice || !fill.benchmarkAt) return null;
  const lag = +fill.at - +fill.benchmarkAt;
  if (lag <= 0 || lag > 30000) return null;
  return (
    (fill.price - fill.benchmarkPrice) *
    fill.quantity *
    fill.multiplier *
    fill.fx
  );
}
export function reconcileLots(fills: Fill[]) {
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
      const entryRatio = amount / Math.abs(lot.fill.quantity);
      const exitRatio = amount / Math.abs(fill.quantity);
      const entryRaw = fillFee(lot.fill),
        exitRaw = fillFee(fill);
      const entryFee = entryRaw === null ? null : entryRaw * entryRatio;
      const exitFee = exitRaw === null ? null : exitRaw * exitRatio;
      const entrySlip = fillSlippage(lot.fill),
        exitSlip = fillSlippage(fill);
      const coverage =
        (Number(entrySlip !== null) + Number(exitSlip !== null)) / 2;
      closed.push({
        externalId: `fifo:${lot.fill.externalId}:${fill.externalId}`,
        symbol: fill.symbol,
        currency: fill.currency ?? null,
        conid: fill.conid,
        quantity: amount * Math.sign(lot.fill.quantity),
        entry: lot.fill.price,
        exit: fill.price,
        multiplier: fill.multiplier,
        fx: fill.fx,
        fees: (entryFee ?? 0) + (exitFee ?? 0),
        feesKnown: entryFee !== null && exitFee !== null,
        entryFee,
        exitFee,
        slippage: coverage
          ? (entrySlip ?? 0) * entryRatio + (exitSlip ?? 0) * exitRatio
          : null,
        slippageCoverage: coverage * 100,
        openedAt: lot.fill.at,
        closedAt: fill.at,
        reason: "unknown",
      });
      remaining -= amount;
      lot.remaining -= amount;
    }
    // An unmatched close is not an opening: older execution data is required.
  }
  return {
    closed,
    open: [...books.values()].flat().filter((lot) => lot.remaining > 0),
  };
}
export function matchLots(fills: Fill[]) {
  return reconcileLots(fills).closed;
}
