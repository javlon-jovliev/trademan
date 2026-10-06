"use client";
import { HelpProvider, ValueHelp } from "./ValueHelp";
import { CostsPanel } from "./Costs";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSessionActivity } from "./useSessionActivity";
import {
  LayoutDashboard,
  Briefcase,
  SlidersHorizontal,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { en, uz, type Key } from "@/i18n/dictionaries";
import type { State } from "./types";
import { riskAlertText } from "@/risk/messages";
const EquityChart = dynamic(() =>
  import("./Charts").then((m) => m.EquityChart),
);
import { Portfolio, HistoryPage } from "./Positions";
import { Scenarios, ScenarioEditor } from "./Scenarios";
import { SettingsPage } from "./Settings";
import { AccountMenu } from "./AccountMenu";
import { Notifications } from "./Notifications";
export type T = (key: Key) => string;
export type Action = (
  route: string,
  body: unknown,
  options?: { silent?: boolean },
) => Promise<void>;
export const money = (v: number | null | undefined, currency = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(v);
export const percent = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)}%`;
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <ValueHelp label={label} icon>
        {label}
      </ValueHelp>
      <ValueHelp label={label}>
        <strong>{value}</strong>
      </ValueHelp>
    </div>
  );
}
export function Badge({ status, t }: { status: string; t: T }) {
  return (
    <span className={`badge ${status}`}>
      {t(
        ([
          "normal",
          "warning",
          "breach",
          "unknown",
          "active",
          "draft",
          "inactive",
        ].includes(status)
          ? status
          : "unknown") as Key,
      )}
    </span>
  );
}
export default function Platform({ route }: { route: string }) {
  useSessionActivity();
  const router = useRouter();
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (r.status === 401) {
      router.replace("/login");
      return;
    }
    if (!r.ok) throw Error("Failed to load data");
    setData(await r.json());
  }, [router]);
  useEffect(() => {
    reload().catch((e) => setError(String(e)));
    const timer = setInterval(() => reload().catch(() => {}), 30000);
    return () => {
      clearInterval(timer);
    };
  }, [reload]);
  useEffect(() => {
    const media = matchMedia("(max-width: 600px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setDrawer(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!drawer || !mobile) return;
    const sidebar = sidebarRef.current;
    const menuButton = menuRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar?.querySelector<HTMLElement>("button, a")?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawer(false);
      }
      if (e.key !== "Tab" || !sidebar) return;
      const items = Array.from(
        sidebar.querySelectorAll<HTMLElement>("a, button, select"),
      ).filter(
        (el) => el.getClientRects().length && !el.hasAttribute("disabled"),
      );
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      menuButton?.focus();
    };
  }, [drawer, mobile]);
  const t: T = (key) => (data?.user.language === "en" ? en : uz)[key];
  useEffect(() => {
    if (!data) return;
    document.documentElement.lang = data.user.language;
    const dark =
      data.user.theme === "dark" ||
      (data.user.theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [data]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const action: Action = async (path, body, options) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const r = await fetch(`/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      await reload();
      if (!options?.silent) setNotice(t("saved"));
    } catch (e) {
      setError(
        e instanceof TypeError
          ? t("networkError")
          : e instanceof Error
            ? e.message
            : String(e),
      );
      throw e;
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <main className="loading">{error || t("loading")}</main>;
  const section = route.split("/")[0] as Key;
  const nav = [
    { key: "dashboard", icon: LayoutDashboard },
    { key: "portfolio", icon: Briefcase },
    { key: "scenarios", icon: SlidersHorizontal },
    { key: "history", icon: History },
  ] as const;
  const preferences = async (patch: Partial<State["user"]>) => {
    await action(
      "settings",
      {
        ...data.user,
        telegramChatId: data.user.telegramChatId ?? "",
        ...patch,
      },
      { silent: true },
    );
  };
  const account = data.account;
  return (
    <HelpProvider
      language={data.user.language}
      currency={account?.currency}
      timezone={account?.timezone}
    >
      <div
        className={`shell ${data.user.collapsed ? "collapsed" : ""} ${drawer ? "drawer-open" : ""}`}
      >
        <a className="skip-link" href="#main-content">
          {t("skipContent")}
        </a>
        <aside
          className="sidebar"
          ref={sidebarRef}
          inert={mobile && !drawer}
          role={mobile && drawer ? "dialog" : undefined}
          aria-modal={mobile && drawer ? true : undefined}
          aria-label={t("navigation")}
          id="navigation"
        >
          <div className="sidebar-head">
            <Link href="/dashboard" className="brand" aria-label="ERTA">
              <span className="logo">e</span>
              <strong>ERTA</strong>
            </Link>
            <button
              className="collapse"
              aria-label={t("toggleMenu")}
              onClick={() =>
                preferences({ collapsed: !data.user.collapsed }).catch(() => {})
              }
            >
              {data.user.collapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>
          </div>
          <button
            className="mobile-close"
            aria-label={t("close")}
            onClick={() => setDrawer(false)}
          >
            ×
          </button>
          <nav aria-label={t("navigation")}>
            {nav.map(({ key, icon: Icon }) => (
              <Link
                key={key}
                href={`/${key}`}
                onClick={() => setDrawer(false)}
                title={t(key)}
                aria-label={t(key)}
                aria-current={section === key ? "page" : undefined}
                className={section === key ? "selected" : ""}
              >
                <Icon size={19} />
                <span>{t(key)}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              href="/settings"
              title={t("settings")}
              aria-label={t("settings")}
              aria-current={section === "settings" ? "page" : undefined}
              onClick={() => setDrawer(false)}
              className={section === "settings" ? "selected" : ""}
            >
              <Settings size={19} />
              <span>{t("settings")}</span>
            </Link>
            <AccountMenu
              user={data.user}
              t={t}
              onLanguage={(language) =>
                preferences({ language }).catch(() => {})
              }
              onLogout={async () => {
                await action("logout", {}).catch(() => {});
                router.replace("/login");
              }}
            />
          </div>
        </aside>
        {drawer && (
          <button
            className="scrim"
            aria-label={t("close")}
            onClick={() => setDrawer(false)}
          />
        )}
        <main
          className="content"
          id="main-content"
          tabIndex={-1}
          aria-busy={busy}
          inert={mobile && drawer}
        >
          <header>
            <button
              className="mobile-menu"
              ref={menuRef}
              aria-label={t("navigation")}
              aria-expanded={drawer}
              aria-controls="navigation"
              onClick={() => setDrawer(!drawer)}
            >
              <Menu />
            </button>
            <h1>{t(section)}</h1>
            <div className="header-tools">
              <BrokerContext
                account={account}
                stale={data.stale}
                demo={data.demo}
                t={t}
              />
              <Notifications data={data} t={t} action={action} />
            </div>
          </header>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button aria-label={t("close")} onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="save-toast" role="status">
              {notice}
              <button aria-label={t("close")} onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {data.stale && (
            <div className="banner error">
              {t("stale")} · {account?.syncError}
            </div>
          )}
          {route === "dashboard" && (
            <Dashboard data={data} t={t} action={action} />
          )}
          {route === "portfolio" && (
            <Portfolio data={data} t={t} action={action} />
          )}
          {route === "history" && (
            <HistoryPage data={data} t={t} action={action} />
          )}
          {route === "scenarios" && (
            <Scenarios data={data} t={t} action={action} />
          )}
          {route.startsWith("scenarios/") && (
            <ScenarioEditor
              key={route}
              data={data}
              t={t}
              action={action}
              id={route.split("/")[1]}
            />
          )}
          {route === "settings" && (
            <SettingsPage data={data} t={t} action={action} />
          )}
        </main>
      </div>
    </HelpProvider>
  );
}
function BrokerContext({
  account,
  stale,
  demo,
  t,
}: {
  account: State["account"];
  stale: boolean;
  demo: boolean;
  t: T;
}) {
  const [clock, setClock] = useState(new Date());
  const [health, setHealth] = useState<{
    connected: boolean;
    checkedAt: number | null;
  } | null>(null);
  useEffect(() => {
    if (demo || account?.mode !== "live") return;
    let stopped = false;
    const controller = new AbortController();
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/connection", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw Error("Unavailable");
        const result = await r.json();
        if (!stopped) setHealth(result);
      } catch {
        if (!stopped) setHealth({ connected: false, checkedAt: Date.now() });
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [demo, account?.id, account?.mode]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const isDemo = demo || account?.mode === "demo";
  const healthy =
    !isDemo &&
    health?.connected &&
    health.checkedAt !== null &&
    +clock - health.checkedAt < 60000;
  const status = isDemo
    ? t("demoConnection")
    : !health
      ? t("checking")
      : healthy
        ? t("connected")
        : t("disconnected");
  return (
    <div className="broker-context">
      <span
        role="img"
        aria-label={status}
        title={`${status}. ${!isDemo ? t("gatewayStatusHelp") : ""}${stale ? " · " + t("stale") : ""}`}
        className={`dot connection-signal ${healthy ? "connected" : ""} ${!isDemo && health && !healthy ? "offline" : ""}`}
      />
      {account
        ? `IBKR · ${account.brokerId} · ${clock.toLocaleTimeString("en-US", { timeZone: account.timezone, hour12: false })} ${new Intl.DateTimeFormat("en-US", { timeZone: account.timezone, timeZoneName: "short" }).formatToParts(clock).find((p) => p.type === "timeZoneName")?.value ?? ""}`
        : t("disconnected")}
      {demo && <span className="demo-tag">DEMO</span>}
    </div>
  );
}
function Dashboard({ data, t }: { data: State; t: T; action: Action }) {
  const [period, setPeriod] = useState("1M");
  const { account, risk } = data;
  if (!account || !risk)
    return (
      <div className="empty">
        {t("noData")} <Link href="/settings">{t("connections")}</Link>
      </div>
    );
  const scenario = account.scenarios.find(
    (s) => s.id === account.activeScenarioId,
  );
  const currency = account.currency;
  const sum = (key: "daily" | "pnl") =>
    risk.rows.every((p) => p[key] !== null)
      ? risk.rows.reduce((a, p) => a + (p[key] ?? 0), 0)
      : null;
  const cutoff =
    period === "ALL"
      ? 0
      : +new Date(account.snapshots.at(-1)?.at ?? account.syncedAt ?? 0) -
        ({ "1M": 31, "3M": 93, "1Y": 366 }[period] ?? 31) * 86400000;
  return (
    <>
      <div className="kpis dashboard-kpis">
        {(
          [
            {
              label: "netLiquidation",
              value: account.nlv,
              help: "balanceHelp",
              pnl: false,
            },
            {
              label: "daily",
              value: risk.dailyPnl,
              help: "dailyHelp",
              pnl: true,
            },
            {
              label: "unrealized",
              value: sum("pnl"),
              help: "unrealizedHelp",
              pnl: true,
            },
          ] as const
        ).map((item) => (
          <div className="metric" key={item.label}>
            <ValueHelp label={t(item.label)} icon>
              {t(item.label)}
            </ValueHelp>
            <ValueHelp label={t(item.label)}>
              <strong
                className={
                  item.pnl && item.value != null
                    ? item.value >= 0
                      ? "positive"
                      : "negative"
                    : ""
                }
              >
                {item.pnl && item.value != null
                  ? item.value >= 0
                    ? "↗ "
                    : "↘ "
                  : ""}
                {money(item.value, currency)}
              </strong>
            </ValueHelp>
          </div>
        ))}
        <div className="metric">
          <ValueHelp label={t("heat")} icon>
            {t("heat")}
          </ValueHelp>
          <ValueHelp label={t("heat")}>
            <strong>{percent(risk.heat)}</strong>
          </ValueHelp>
          <span className="kpi-limit">
            {t("limitLabel")}: {percent(scenario?.maxHeat)}
          </span>
        </div>
      </div>
      <div className="dashboard-main">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <ValueHelp label={t("equity")} icon>
                {t("equity")}
              </ValueHelp>
            </h2>
            <select
              aria-label={t("period")}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {["1M", "3M", "1Y", "ALL"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <EquityChart
            points={account.snapshots.filter((p) => +new Date(p.at) >= cutoff)}
            label={t("equity")}
            currency={currency}
          />
        </section>
        <section className="panel">
          <h2>
            <ValueHelp label={t("risk")} icon help={t("riskHelp")}>
              {t("risk")}
            </ValueHelp>
          </h2>
          <Badge status={risk.status} t={t} />
          {risk.violations.find((v) => v.severity === "breach") && (
            <p className="risk-reason">
              {riskAlertText(
                risk.violations.find((v) => v.severity === "breach")!,
                data.user.language,
              )}
            </p>
          )}
          <h3>{scenario?.name ?? t("noScenario")}</h3>
          <RiskMeter
            label={t("heat")}
            value={risk.heat}
            limit={scenario?.maxHeat}
            t={t}
          />
          <RiskMeter
            label={t("drawdown")}
            value={risk.drawdowns.total}
            limit={scenario?.totalDrawdown}
            t={t}
          />
          <RiskMeter
            label={t("margin")}
            value={risk.margin}
            limit={scenario?.maxMargin}
            t={t}
          />
          <div className="risk-funds">
            <div>
              <ValueHelp label={t("liquidity")} icon>
                {t("liquidity")}
              </ValueHelp>
              <ValueHelp label={t("liquidity")}>
                <strong>{money(account.excessLiquidity, currency)}</strong>
              </ValueHelp>
            </div>
            <div>
              <ValueHelp label={t("buyingPower")} icon>
                {t("buyingPower")}
              </ValueHelp>
              <ValueHelp label={t("buyingPower")}>
                <strong>{money(account.buyingPower, currency)}</strong>
              </ValueHelp>
            </div>
          </div>
          {risk.riskIncreasingBlocked && (
            <p className="negative">{t("blocked")}</p>
          )}
        </section>
      </div>
      <CostsPanel data={data} t={t} />
      <div className="dashboard-bottom">
        <section className="panel">
          <h2>
            <ValueHelp label={t("allocation")} icon>
              {t("allocation")}
            </ValueHelp>
          </h2>
          {Object.entries(risk.assets).map(([name, v]) => (
            <Exposure
              t={t}
              key={name}
              name={name === "STK" ? t("stocks") : name}
              value={v}
            />
          ))}
          <Exposure
            t={t}
            name={t("cash")}
            value={
              account.cash && account.nlv
                ? (account.cash / account.nlv) * 100
                : 0
            }
          />
        </section>
        <section className="panel">
          <h2>
            <ValueHelp label={t("sector")} icon>
              {t("sector")}
            </ValueHelp>
          </h2>
          {Object.entries(risk.sectors).map(([name, v]) => (
            <Exposure
              t={t}
              key={name}
              name={name}
              value={v}
              limit={
                (scenario?.sectorLimits as Record<string, number>)?.[name] ??
                scenario?.sectorLimit
              }
            />
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("topRisk")}</h2>
            <Link href="/portfolio">{t("all")}</Link>
          </div>
          <div className="risk-row risk-row-labels">
            <span>{t("asset")}</span>
            <span>{t("value")}</span>
            <span>{t("heat")}</span>
          </div>
          {[...risk.rows]
            .sort((a, b) => (b.heat ?? -1) - (a.heat ?? -1))
            .slice(0, 5)
            .map((p) => (
              <div className="risk-row" key={p.id}>
                <b>{p.symbol}</b>
                <ValueHelp label={t("value")}>
                  <span>{money(p.value, currency)}</span>
                </ValueHelp>
                <ValueHelp label={t("riskTab")}>
                  <span>{percent(p.heat)}</span>
                </ValueHelp>
              </div>
            ))}
        </section>
      </div>
    </>
  );
}
function RiskMeter({
  label,
  value,
  limit,
  t,
}: {
  label: string;
  value: number | null;
  limit?: number;
  t: T;
}) {
  const ratio =
    value != null && limit != null && limit > 0 ? value / limit : null;
  const tone =
    ratio == null
      ? "unknown"
      : ratio > 1
        ? "danger"
        : ratio >= 0.8
          ? "caution"
          : "safe";
  return (
    <div className={`risk-meter ${tone}`}>
      <div>
        <ValueHelp label={label} icon>
          {label}
        </ValueHelp>
        <ValueHelp label={label}>
          <strong>
            {percent(value)} <small>/ {percent(limit)}</small>
          </strong>
        </ValueHelp>
      </div>
      <div className="risk-meter-track" aria-hidden="true">
        <span
          style={{
            width: `${Math.min(100, Math.max(0, (ratio ?? 0) * 100))}%`,
          }}
        />
      </div>
      <small>
        {ratio == null
          ? t("unknown")
          : ratio > 1
            ? t("breach")
            : ratio >= 0.8
              ? t("warning")
              : t("withinLimit")}{" "}
        · {t("limitLabel")}: {percent(limit)}
      </small>
    </div>
  );
}
function Exposure({
  t,
  name,
  value,
  limit,
}: {
  t: T;
  name: string;
  value: number;
  limit?: number;
}) {
  return (
    <div className="exposure">
      <div>
        <span>{name}</span>
        <ValueHelp label={t(limit ? "sector" : "allocation")}>
          <span>
            {percent(value)}
            {limit ? ` / ${percent(limit)}` : ""}
          </span>
        </ValueHelp>
      </div>
      <div className="bar">
        <i
          style={{
            width: `${Math.min(100, value)}%`,
            background: limit && value > limit ? "#dc2626" : undefined,
          }}
        />
        {limit && <b style={{ left: `${Math.min(100, limit)}%` }} />}
      </div>
    </div>
  );
}
