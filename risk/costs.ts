import {
  fillFee,
  fillSlippage,
  reconcileLots,
  type Fill,
} from "../broker/lots";
type CostPosition = {
  id?: string;
  conid: string;
  quantity: number;
  currentPrice: number | null;
  multiplier: number;
  fx: number | null;
};
export function executionCosts(
  fills: Fill[],
  positions: CostPosition[],
  nlv: number | null,
) {
  const open = reconcileLots(fills).open;
  const byPosition: Record<
    string,
    {
      commission: number | null;
      knownCommission: number;
      slippage: number | null;
      coverage: number;
      quantityCoverage: number;
      total: number | null;
      netPnl: number | null;
    }
  > = {};
  for (const p of positions) {
    const lots = open.filter(
      (l) =>
        l.fill.conid === p.conid &&
        Math.sign(l.fill.quantity) === Math.sign(p.quantity),
    );
    const quantity = lots.reduce((s, l) => s + l.remaining, 0);
    const complete =
      p.quantity !== 0 && Math.abs(quantity - Math.abs(p.quantity)) < 0.000001;
    const fees = lots.map((l) => {
      const fee = fillFee(l.fill);
      return fee === null
        ? null
        : (fee * l.remaining) / Math.abs(l.fill.quantity);
    });
    const knownCommission = fees.reduce<number>((s, fee) => s + (fee ?? 0), 0);
    const commission =
      complete && fees.every((fee) => fee !== null) ? knownCommission : null;
    let measuredQuantity = 0,
      measuredSlippage = 0;
    for (const l of lots) {
      const slip = fillSlippage(l.fill);
      if (slip !== null) {
        measuredQuantity += l.remaining;
        measuredSlippage += (slip * l.remaining) / Math.abs(l.fill.quantity);
      }
    }
    const coverage = Math.abs(p.quantity)
      ? Math.min(100, (measuredQuantity / Math.abs(p.quantity)) * 100)
      : 0;
    const slippage = complete && measuredQuantity > 0 ? measuredSlippage : null;
    const gross =
      complete && p.currentPrice !== null && p.fx !== null
        ? lots.reduce(
            (s, l) =>
              s +
              (p.currentPrice! - l.fill.price) *
                l.remaining *
                Math.sign(l.fill.quantity) *
                p.multiplier *
                p.fx!,
            0,
          )
        : null;
    byPosition[p.id ?? p.conid] = {
      commission,
      knownCommission,
      slippage,
      coverage,
      quantityCoverage: Math.abs(p.quantity)
        ? Math.min(100, (quantity / Math.abs(p.quantity)) * 100)
        : 0,
      total:
        commission !== null && slippage !== null && coverage >= 99.999999
          ? commission + slippage
          : null,
      netPnl: gross !== null && commission !== null ? gross - commission : null,
    };
  }
  const fees = fills.map(fillFee),
    slips = fills.map(fillSlippage);
  const knownCommission = fees.reduce<number>((s, f) => s + (f ?? 0), 0);
  const feeCount = fees.filter((f) => f !== null).length;
  const slipCount = slips.filter((f) => f !== null).length;
  const slippage = slipCount
    ? slips.reduce<number>((s, f) => s + (f ?? 0), 0)
    : null;
  const commission =
    fills.length && feeCount === fills.length ? knownCommission : null;
  const dates = fills.map((f) => +f.at).filter(Number.isFinite);
  return {
    positions: byPosition,
    summary: {
      commission,
      knownCommission,
      feeCount,
      fillCount: fills.length,
      slippage,
      slipCount,
      coverage: fills.length ? (slipCount / fills.length) * 100 : 0,
      total:
        commission !== null && slippage !== null && slipCount === fills.length
          ? commission + slippage
          : null,
      equityPercent:
        commission !== null && nlv !== null && nlv > 0
          ? (commission / nlv) * 100
          : null,
      from: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
      to: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    },
  };
}
export type ExecutionCosts = ReturnType<typeof executionCosts>;
