"use client";
import { dateLabel } from "./DateTime";
import { ValueHelp } from "./ValueHelp";
import { ReceiptText } from "lucide-react";
import type { State } from "./types";
import { type T, money, percent } from "./Platform";
export function CostCell({
  commission,
  slippage,
  coverage,
  t,
  currency,
}: {
  commission: number | null;
  slippage: number | null;
  coverage: number;
  t: T;
  currency?: string;
}) {
  return (
    <span className="cost-cell">
      <span title={t("commissionCost")}>{money(commission, currency)}</span>
      <small
        title={`${t("slippageCost")} · ${t("costCoverage")}: ${percent(coverage)}`}
      >
        {t("slippageCost")}:{" "}
        <span
          className={
            slippage == null ? "muted" : slippage < 0 ? "positive" : "negative"
          }
        >
          {money(slippage, currency)}
        </span>
        {slippage !== null && coverage < 99.999999 ? " *" : ""}
      </small>
    </span>
  );
}
export function CostsPanel({ data, t }: { data: State; t: T }) {
  const c = data.costs?.summary;
  if (!c) return null;
  const currency = data.account?.currency;
  const formatDate = (value: string | null) =>
    value
      ? dateLabel(
          value,
          data.account?.timezone ?? data.user.timezone,
          data.user.language,
        )
      : "—";
  return (
    <section className="panel costs-panel">
      <div className="panel-heading">
        <h2>
          <ReceiptText size={17} aria-hidden="true" />
          <ValueHelp
            label={t("executionCosts")}
            icon
            help={t("costHistoryHelp")}
          >
            {t("executionCosts")}
          </ValueHelp>
        </h2>
        <span className="muted">
          {formatDate(c.from)} – {formatDate(c.to)}
        </span>
      </div>
      <div className="cost-metrics">
        <CostMetric
          label={t("commissionCost")}
          value={c.commission ?? (c.feeCount ? c.knownCommission : null)}
          currency={currency}
          help={
            c.commission === null
              ? `${t("partialCost")} · ${c.feeCount}/${c.fillCount}`
              : `${percent(c.equityPercent)} ${t("costEquity")}`
          }
        />
        <CostMetric
          label={t("slippageCost")}
          value={c.slippage}
          currency={currency}
          help={`${t("costCoverage")}: ${percent(c.coverage)} · ${c.slipCount}/${c.fillCount}`}
        />
        <CostMetric
          label={t("totalExecutionCost")}
          value={c.total}
          currency={currency}
          help={
            c.total === null
              ? t("costMissing")
              : t("commissionCost") + " + slippage"
          }
        />
      </div>
    </section>
  );
}
export function CostMetric({
  label,
  value,
  currency,
  help,
  net,
}: {
  label: string;
  value: number | null;
  currency?: string;
  help?: string;
  net?: boolean;
}) {
  return (
    <div className="cost-metric">
      <ValueHelp label={label} icon>
        {label}
      </ValueHelp>
      <ValueHelp label={label}>
        <strong
          className={
            value === null
              ? "muted"
              : value < 0
                ? net
                  ? "negative"
                  : "positive"
                : net
                  ? "positive"
                  : undefined
          }
        >
          {money(value, currency)}
        </strong>
      </ValueHelp>
      {help && <small>{help}</small>}
    </div>
  );
}
export function PositionCosts({
  data,
  positionId,
  t,
}: {
  data: State;
  positionId: string;
  t: T;
}) {
  const c = data.costs?.positions[positionId];
  return (
    <section className="position-costs">
      <h3>
        <ValueHelp label={t("executionCosts")} icon help={t("openCostHelp")}>
          {t("executionCosts")}
        </ValueHelp>
      </h3>
      <div className="cost-metrics">
        <CostMetric
          label={t("commissionCost")}
          value={c?.commission ?? null}
          currency={data.account?.currency}
          help={t("entryCommission")}
        />
        <CostMetric
          label={t("slippageCost")}
          value={c?.slippage ?? null}
          currency={data.account?.currency}
          help={`${t("costCoverage")}: ${percent(c?.coverage ?? 0)}`}
        />
        <CostMetric
          net
          label={t("netExecutionPnl")}
          value={data.stale ? null : (c?.netPnl ?? null)}
          currency={data.account?.currency}
        />
      </div>
    </section>
  );
}
