export type RiskPosition = {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  currentPrice: number | null;
  averagePrice: number;
  previousClose: number | null;
  multiplier: number;
  fx: number | null;
  riskStop: number | null;
  sector: string;
  assetClass: string;
};
export type Policy = {
  maxHeat: number;
  warningHeat: number;
  maxTradeRisk: number;
  maxPosition: number;
  maxGross: number;
  maxNet: number;
  maxMargin: number;
  minLiquidity: number;
  dailyLoss: number;
  weeklyLoss: number;
  monthlyLoss: number;
  totalDrawdown: number;
  sectorLimit: number;
  sectorLimits: unknown;
  assetLimits: unknown;
  requireStops: boolean;
  warningPercent: number;
};
export type EquityPoint = {
  at: Date | string;
  nlv: number;
  externalFlow: number;
};
export type Violation = {
  key: string;
  severity: "warning" | "breach" | "unknown";
  value: number | null;
  limit: number | null;
};
export function positionMetrics(p: RiskPosition, nlv: number | null) {
  const valid =
    nlv !== null &&
    nlv > 0 &&
    p.currentPrice !== null &&
    p.fx !== null &&
    p.fx > 0;
  const value = valid
    ? p.quantity * p.currentPrice! * p.multiplier * p.fx!
    : null;
  const pnl = valid
    ? (p.currentPrice! - p.averagePrice) * p.quantity * p.multiplier * p.fx!
    : null;
  const daily =
    valid && p.previousClose !== null
      ? (p.currentPrice! - p.previousClose) * p.quantity * p.multiplier * p.fx!
      : null;
  const heat =
    valid && p.riskStop !== null
      ? ((Math.abs(p.currentPrice! - p.riskStop) *
          Math.abs(p.quantity) *
          p.multiplier *
          p.fx!) /
          nlv!) *
        100
      : null;
  return {
    ...p,
    value,
    pnl,
    daily,
    weight: value === null ? null : (Math.abs(value) / nlv!) * 100,
    heat,
  };
}
function dateParts(at: Date | string, tz: string) {
  const d = new Date(at);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function drawdowns(
  points: EquityPoint[],
  current: number,
  now: Date,
  tz: string,
) {
  const sorted = [...points]
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
    .filter((p) => +new Date(p.at) <= +now);
  const today = dateParts(now, tz);
  const calendar = new Date(`${today}T12:00:00Z`);
  const week = new Date(calendar);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const boundaries = {
    daily: today,
    weekly: week.toISOString().slice(0, 10),
    monthly: today.slice(0, 7) + "-01",
  };
  const losses: Record<string, number | null> = {};
  for (const [key, boundary] of Object.entries(boundaries)) {
    const base = sorted.filter((p) => dateParts(p.at, tz) < boundary).at(-1);
    if (!base || base.nlv <= 0) {
      losses[key] = null;
      continue;
    }
    const flows = sorted
      .filter((p) => +new Date(p.at) > +new Date(base.at))
      .reduce((a, p) => a + p.externalFlow, 0);
    losses[key] = Math.max(0, ((base.nlv + flows - current) / base.nlv) * 100);
  }
  // Cash-flow adjusted unitized NAV prevents deposits from appearing as performance.
  let units = 1;
  let previous = sorted[0]?.nlv;
  let high = previous ?? current;
  let latest = previous ?? current;
  for (const p of sorted.slice(1)) {
    if (previous && previous > 0) units *= 1 + p.externalFlow / previous;
    latest = p.nlv / units;
    high = Math.max(high, latest);
    previous = p.nlv;
  }
  if (sorted.length) latest = current / units;
  losses.total = high > 0 ? Math.max(0, ((high - latest) / high) * 100) : null;
  return losses;
}
export function dailyPnL(
  points: EquityPoint[],
  current: number | null,
  now: Date,
  tz: string,
) {
  if (current === null) return null;
  const today = dateParts(now, tz);
  const sorted = [...points]
    .filter((p) => +new Date(p.at) <= +now)
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const base = sorted.filter((p) => dateParts(p.at, tz) < today).at(-1);
  if (!base) return null;
  const flow = sorted
    .filter((p) => +new Date(p.at) > +new Date(base.at))
    .reduce((a, p) => a + p.externalFlow, 0);
  return current - base.nlv - flow;
}
export function evaluate(
  positions: RiskPosition[],
  account: {
    nlv: number | null;
    maintenanceMargin: number | null;
    excessLiquidity: number | null;
    timezone: string;
  },
  policy: Policy | null,
  snapshots: EquityPoint[],
  now = new Date(),
) {
  const rows = positions.map((p) => positionMetrics(p, account.nlv));
  const complete = rows.every((p) => p.heat !== null);
  const priced = rows.every((p) => p.value !== null);
  const nlv = account.nlv;
  const knownHeat = rows.reduce((a, p) => a + (p.heat ?? 0), 0);
  const heat = complete && nlv !== null && nlv > 0 ? knownHeat : null;
  const gross =
    priced && nlv && nlv > 0
      ? (rows.reduce((a, p) => a + Math.abs(p.value ?? 0), 0) / nlv) * 100
      : null;
  const net =
    priced && nlv && nlv > 0
      ? (rows.reduce((a, p) => a + (p.value ?? 0), 0) / nlv) * 100
      : null;
  const sectors: Record<string, number> = {};
  const assets: Record<string, number> = {};
  rows.forEach((p) => {
    if (p.weight !== null) {
      sectors[p.sector] = (sectors[p.sector] ?? 0) + p.weight;
      assets[p.assetClass] = (assets[p.assetClass] ?? 0) + p.weight;
    }
  });
  const dd =
    nlv && nlv > 0
      ? drawdowns(snapshots, nlv, now, account.timezone)
      : { daily: null, weekly: null, monthly: null, total: null };
  const margin =
    nlv && nlv > 0 && account.maintenanceMargin !== null
      ? (account.maintenanceMargin / nlv) * 100
      : null;
  const liquidity =
    nlv && nlv > 0 && account.excessLiquidity !== null
      ? (account.excessLiquidity / nlv) * 100
      : null;
  const violations: Violation[] = [];
  function check(
    key: string,
    value: number | null,
    limit: number,
    inverse = false,
  ) {
    if (value === null) {
      violations.push({ key, value, limit, severity: "unknown" });
      return;
    }
    if (inverse ? value < limit : value > limit)
      violations.push({ key, value, limit, severity: "breach" });
    else if (
      inverse
        ? value < limit * 1.2
        : value >= (limit * (policy?.warningPercent ?? 80)) / 100
    )
      violations.push({ key, value, limit, severity: "warning" });
  }
  if (policy) {
    check("heat", heat, policy.maxHeat);
    if (
      heat !== null &&
      heat >= policy.warningHeat &&
      !violations.some((v) => v.key === "heat")
    )
      violations.push({
        key: "heat",
        value: heat,
        limit: policy.maxHeat,
        severity: "warning",
      });
    check("gross", gross, policy.maxGross);
    check("net", net === null ? null : Math.abs(net), policy.maxNet);
    check("margin", margin, policy.maxMargin);
    check("liquidity", liquidity, policy.minLiquidity, true);
    for (const [key, limit] of Object.entries({
      daily: policy.dailyLoss,
      weekly: policy.weeklyLoss,
      monthly: policy.monthlyLoss,
      total: policy.totalDrawdown,
    }))
      check(key, dd[key], limit);
    rows.forEach((p) => {
      check(`position:${p.symbol}:${p.id}`, p.weight, policy.maxPosition);
      if (p.heat !== null || policy.requireStops)
        check(`trade:${p.symbol}:${p.id}`, p.heat, policy.maxTradeRisk);
    });
    const limits = policy.sectorLimits as Record<string, number>;
    for (const [sector, value] of Object.entries(sectors))
      check(
        `sector:${sector}`,
        priced ? value : null,
        limits[sector] ?? policy.sectorLimit,
      );
    for (const [asset, limit] of Object.entries(
      policy.assetLimits as Record<string, number>,
    ))
      check(`asset:${asset}`, priced ? (assets[asset] ?? 0) : null, limit);
  }
  if (!policy)
    violations.push({
      key: "scenario",
      severity: "unknown",
      value: null,
      limit: null,
    });
  return {
    rows,
    dailyPnl: dailyPnL(snapshots, nlv, now, account.timezone),
    heat,
    knownHeat,
    complete,
    gross,
    net,
    margin,
    liquidity,
    drawdowns: dd,
    sectors,
    assets,
    violations,
    status: violations.some((v) => v.severity === "breach")
      ? "breach"
      : violations.some((v) => v.severity === "unknown")
        ? "unknown"
        : violations.length
          ? "warning"
          : "normal",
    riskIncreasingBlocked: violations.some(
      (v) => v.severity === "breach" || v.severity === "unknown",
    ),
  };
}
export type Bar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};
export function postExit(
  trade: {
    quantity: number;
    exit: number;
    entry: number;
    fees: number;
    multiplier: number;
    fx: number;
    closedAt: Date | string;
  },
  bars: Bar[],
) {
  const after = bars.filter(
    (b) => b.time > new Date(trade.closedAt).toISOString().slice(0, 10),
  );
  const factor = trade.quantity * trade.multiplier * trade.fx;
  const realized = (trade.exit - trade.entry) * factor - trade.fees;
  if (!after.length)
    return {
      realized,
      hypothetical: null,
      missed: null,
      mae: null,
      mfe: null,
      maxDrawdown: null,
    };
  const hypothetical =
    (after.at(-1)!.close - trade.entry) * factor - trade.fees;
  const changes = after.flatMap((b) => [
    (b.low - trade.exit) * factor,
    (b.high - trade.exit) * factor,
  ]);
  let peak = 0,
    dd = 0;
  for (const b of after) {
    const favorable = (trade.quantity > 0 ? b.high : b.low) - trade.exit;
    peak = Math.max(peak, favorable * factor);
    const adverse =
      ((trade.quantity > 0 ? b.low : b.high) - trade.exit) * factor;
    dd = Math.max(dd, peak - adverse);
  }
  return {
    realized,
    hypothetical,
    missed: hypothetical - realized,
    mae: Math.min(0, ...changes),
    mfe: Math.max(0, ...changes),
    maxDrawdown: dd,
  };
}
