"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { State, TradeDTO } from "./types";
import { type T, type Action, money, percent, Badge, Metric } from "./Platform";
import { DataTable } from "./DataTable";
import { Candles } from "./Charts";
import { postExit } from "@/risk/engine";
type Row = NonNullable<State["risk"]>["rows"][number];
export function Portfolio({
  data,
  t,
  action,
}: {
  data: State;
  t: T;
  action: Action;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(false);
  const [side, setSide] = useState("");
  const [sector, setSector] = useState("");
  const [asset, setAsset] = useState("");
  const [profit, setProfit] = useState("");
  const [violations, setViolations] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const risk = data.risk;
  const currency = data.account?.currency;
  const policy = data.account?.scenarios.find(
    (s) => s.id === data.account?.activeScenarioId,
  );
  if (!risk) return <div className="empty">{t("noData")}</div>;
  const status = (p: Row) => {
    const v = risk.violations.filter(
      (v) => v.key.endsWith(`:${p.id}`) || v.key === `sector:${p.sector}`,
    );
    return v.some((v) => v.severity === "breach")
      ? "breach"
      : v.some((v) => v.severity === "unknown")
        ? "unknown"
        : v.length
          ? "warning"
          : "normal";
  };
  const rows = risk.rows.filter(
    (p) =>
      `${p.symbol} ${p.name}`.toLowerCase().includes(query.toLowerCase()) &&
      (!side || (side === "long" ? p.quantity > 0 : p.quantity < 0)) &&
      (!sector || p.sector === sector) &&
      (!asset || p.assetClass === asset) &&
      (!profit ||
        (p.pnl !== null && (profit === "positive" ? p.pnl >= 0 : p.pnl < 0))) &&
      (!violations || status(p) !== "normal") &&
      (!min || (p.heat !== null && p.heat >= Number(min))) &&
      (!max || (p.heat !== null && p.heat <= Number(max))),
  );
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "symbol",
      header: t("asset"),
      cell: ({ row }) => (
        <>
          <b>{row.original.symbol}</b>
          <small>{row.original.name}</small>
        </>
      ),
    },
    {
      accessorKey: "quantity",
      header: t("position"),
      cell: ({ row }) => (
        <>
          {row.original.quantity}
          <small>
            {t(row.original.quantity > 0 ? "long" : "short")} · ×
            {row.original.multiplier}
          </small>
        </>
      ),
    },
    {
      accessorKey: "currentPrice",
      header: t("price"),
      cell: ({ row }) => (
        <>
          {money(row.original.currentPrice, row.original.currency)}
          <small>
            {money(row.original.averagePrice, row.original.currency)}
          </small>
        </>
      ),
    },
    {
      accessorKey: "value",
      header: t("value"),
      cell: ({ row }) => (
        <>
          {money(row.original.value, currency)}
          <small>{percent(row.original.weight)}</small>
        </>
      ),
    },
    {
      accessorKey: "pnl",
      header: t("pnl"),
      cell: ({ row }) => (
        <span className={(row.original.pnl ?? 0) < 0 ? "negative" : "positive"}>
          {money(row.original.pnl, currency)}
          <small
            className={(row.original.daily ?? 0) < 0 ? "negative" : "positive"}
          >
            {money(row.original.daily, currency)}
          </small>
        </span>
      ),
    },
    {
      accessorKey: "heat",
      header: t("riskTab"),
      cell: ({ row }) => (
        <span title={row.original.heat === null ? t("noStop") : undefined}>
          {percent(row.original.heat)}
          <small>
            {percent(policy?.maxTradeRisk)}{" "}
            {t("maxTradeRisk").replace(" %", "")}
          </small>
        </span>
      ),
    },
    {
      id: "status",
      header: t("scenario"),
      cell: ({ row }) => <Badge status={status(row.original)} t={t} />,
    },
    { accessorKey: "sector", header: t("sector") },
  ];
  return (
    <>
      <div className="summary">
        <Metric label={t("count")} value={String(risk.rows.length)} />
        <Metric
          label={t("netLiquidation")}
          value={money(data.account?.nlv, currency)}
        />
        <Metric label={t("heat")} value={percent(risk.heat)} />
      </div>
      <div className="tabs">
        <Link className="active" href="/portfolio">
          {t("openPositions")}
        </Link>
        <Link href="/history">{t("closedPositions")}</Link>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setFilters(!filters)}>
            {t("filters")}{" "}
            {[side, sector, asset, profit, min, max, violations].filter(Boolean)
              .length || ""}
          </button>
          <button onClick={() => exportCSV(rows, "portfolio.csv")}>
            {t("export")}
          </button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              {t("side")}
              <select value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="">—</option>
                <option value="long">{t("long")}</option>
                <option value="short">{t("short")}</option>
              </select>
            </label>
            <label>
              {t("sector")}
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="">—</option>
                {Object.keys(risk.sectors).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              {t("assetClass")}
              <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                <option value="">—</option>
                {Object.keys(risk.assets).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              P&L
              <select
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
              >
                <option value="">—</option>
                <option value="positive">{t("profitable")}</option>
                <option value="negative">{t("losing")}</option>
              </select>
            </label>
            <label>
              {t("minHeat")}
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            </label>
            <label>
              {t("maxHeatFilter")}
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={violations}
                onChange={(e) => setViolations(e.target.checked)}
              />
              {t("violation")}
            </label>
            <button
              onClick={() => {
                setSide("");
                setSector("");
                setAsset("");
                setProfit("");
                setMin("");
                setMax("");
                setViolations(false);
              }}
            >
              {t("clear")}
            </button>
          </div>
        )}
        <DataTable data={rows} columns={columns} onRow={setSelected} />
        {!rows.length && <p className="empty">{t("noData")}</p>}
      </section>
      {selected && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="modal-backdrop" />
            <Dialog.Content
              className="position-drawer"
              aria-describedby={undefined}
            >
              <div className="panel-heading">
                <Dialog.Title asChild>
                  <h2>{selected.symbol}</h2>
                </Dialog.Title>
                <button autoFocus onClick={() => setSelected(null)}>
                  {t("close")}
                </button>
              </div>
              <p>{selected.name}</p>
              <Badge status={status(selected)} t={t} />
              <dl>
                {[
                  ["position", selected.quantity],
                  ["entry", money(selected.averagePrice, selected.currency)],
                  ["price", money(selected.currentPrice, selected.currency)],
                  ["value", money(selected.value, currency)],
                  ["daily", money(selected.daily, currency)],
                  ["pnl", money(selected.pnl, currency)],
                  ["heat", percent(selected.heat)],
                  ["maxTradeRisk", percent(policy?.maxTradeRisk)],
                  ["sector", selected.sector],
                  ["sectorLimit", percent(risk.sectors[selected.sector])],
                ].map(([key, v]) => (
                  <div className="dl-row" key={key}>
                    <dt>{t(key as Parameters<T>[0])}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get("stop");
                  await action("position/stop", {
                    id: selected.id,
                    riskStop: value ? Number(value) : null,
                    sector: new FormData(e.currentTarget).get("sector"),
                  })
                    .then(() => setSelected(null))
                    .catch(() => {});
                }}
              >
                <label>
                  {t("riskStop")}
                  <input
                    name="stop"
                    type="number"
                    step="any"
                    min="0.00001"
                    defaultValue={selected.riskStop ?? ""}
                  />
                </label>
                <label>
                  {t("sector")}
                  <input
                    name="sector"
                    defaultValue={selected.sector}
                    required
                    maxLength={60}
                  />
                </label>
                <button className="primary">{t("save")}</button>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
export function HistoryPage({
  data,
  t,
  action,
}: {
  data: State;
  t: T;
  action: Action;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(false);
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState("");
  const currency = data.account?.currency;
  const trades = data.account?.trades ?? [];
  const rows = trades.filter(
    (p) =>
      p.symbol.toLowerCase().includes(query.toLowerCase()) &&
      (!reason || p.reason === reason) &&
      (!from || p.closedAt.slice(0, 10) >= from) &&
      (!to || p.closedAt.slice(0, 10) <= to),
  );
  const columns: ColumnDef<TradeDTO>[] = [
    { accessorKey: "symbol", header: t("asset") },
    {
      accessorKey: "closedAt",
      header: t("closedAt"),
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
    },
    { accessorKey: "quantity", header: t("position") },
    {
      accessorKey: "entry",
      header: t("entry"),
      cell: ({ getValue }) => money(getValue() as number, currency),
    },
    {
      accessorKey: "exit",
      header: t("exit"),
      cell: ({ getValue }) => money(getValue() as number, currency),
    },
    {
      id: "pnl",
      header: t("realized"),
      accessorFn: (p) => postExit(p, p.bars).realized,
      cell: ({ getValue }) => (
        <span className={(getValue() as number) < 0 ? "negative" : "positive"}>
          {money(getValue() as number, currency)}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: t("reason"),
      cell: ({ getValue }) =>
        t(
          ({
            stop_loss: "stopLoss",
            take_profit: "takeProfit",
            manual: "manual",
          }[getValue() as string] ?? "unclassified") as Parameters<T>[0],
        ),
    },
  ];
  return (
    <section className="panel table-panel">
      <div className="toolbar">
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => setFilters(!filters)}>{t("filters")}</button>
        <button onClick={() => exportCSV(rows, "history.csv")}>
          {t("export")}
        </button>
      </div>
      {filters && (
        <div className="filter-panel">
          <label>
            {t("reason")}
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">—</option>
              {["stop_loss", "take_profit", "manual", "unknown"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            {t("from")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("to")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              setReason("");
              setFrom("");
              setTo("");
            }}
          >
            {t("clear")}
          </button>
        </div>
      )}
      <DataTable
        data={rows}
        columns={columns}
        onRow={(r) => setExpanded(expanded === r.id ? "" : r.id)}
        expanded={(r) =>
          expanded === r.id ? (
            <TradeDetails
              key={r.id}
              trade={r}
              t={t}
              currency={currency}
              action={action}
            />
          ) : null
        }
      />
      {!rows.length && <p className="empty">{t("noData")}</p>}
    </section>
  );
}
function TradeDetails({
  trade,
  t,
  currency,
  action,
}: {
  trade: TradeDTO;
  t: T;
  currency?: string;
  action: Action;
}) {
  const metrics = postExit(trade, trade.bars);
  return (
    <div className="trade-details">
      <div className="summary">
        {Object.entries(metrics).map(([key, value]) => (
          <Metric
            key={key}
            label={t(key as Parameters<T>[0])}
            value={money(value, currency)}
          />
        ))}
      </div>
      <p className="muted">{t("postExitHelp")}</p>
      {trade.bars.length > 0 && (
        <Candles
          bars={trade.bars}
          entry={trade.openedAt}
          exit={trade.closedAt}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action("trade/notes", {
            id: trade.id,
            notes: new FormData(e.currentTarget).get("notes"),
          }).catch(() => {});
        }}
      >
        <label>
          {t("notes")}
          <textarea name="notes" defaultValue={trade.notes} />
        </label>
        <button>{t("save")}</button>
      </form>
    </div>
  );
}
function exportCSV<T extends object>(rows: T[], name: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter(
    (k) => typeof (rows[0] as Record<string, unknown>)[k] !== "object",
  );
  const escape = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""')}"`;
  const csv = [
    keys.join(","),
    ...rows.map((r) =>
      keys.map((k) => escape((r as Record<string, unknown>)[k])).join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
