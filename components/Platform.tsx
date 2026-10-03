"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  SlidersHorizontal,
  History,
  Settings,
  PanelLeftClose,
  Menu,
  LogOut,
  Globe,
} from "lucide-react";
import { en, uz, type Key } from "@/i18n/dictionaries";
import type { State } from "./types";
const EquityChart = dynamic(() =>
  import("./Charts").then((m) => m.EquityChart),
);
import { Portfolio, HistoryPage } from "./Positions";
import { Scenarios, ScenarioEditor } from "./Scenarios";
import { SettingsPage } from "./Settings";
export type T = (key: Key) => string;
export type Action = (route: string, body: unknown) => Promise<void>;
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
      <span>{label}</span>
      <strong>{value}</strong>
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
  const action: Action = async (path, body) => {
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
      setNotice(t("saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    await action("settings", {
      ...data.user,
      telegramChatId: data.user.telegramChatId ?? "",
      ...patch,
    });
  };
  const account = data.account;
  return (
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
        <Link href="/dashboard" className="brand">
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
          <PanelLeftClose size={18} />
        </button>
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
          <label className="language">
            <Globe size={18} />
            <select
              aria-label={t("language")}
              value={data.user.language}
              onChange={(e) =>
                preferences({ language: e.target.value as "uz" | "en" }).catch(
                  () => {},
                )
              }
            >
              <option value="uz">O‘zbekcha</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="user">
            <span className="avatar">
              {data.user.username[0].toUpperCase()}
            </span>
            <span>{data.user.username}</span>
            <button
              title={t("logout")}
              onClick={async () => {
                await action("logout", {}).catch(() => {});
                router.replace("/login");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
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
          <BrokerContext
            account={account}
            stale={data.stale}
            demo={data.demo}
            t={t}
          />
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
          <div className="banner success" role="status">
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
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="broker-context">
      <span
        className={`dot ${account?.connected && !stale ? "connected" : ""}`}
      />
      {account
        ? `IBKR · ${account.brokerId} · ${clock.toLocaleTimeString("en-US", { timeZone: account.timezone, hour12: false })} ${new Intl.DateTimeFormat("en-US", { timeZone: account.timezone, timeZoneName: "short" }).formatToParts(clock).find((p) => p.type === "timeZoneName")?.value ?? ""}`
        : t("disconnected")}
      {demo && <span className="demo-tag">DEMO</span>}
    </div>
  );
}
function Dashboard({ data, t, action }: { data: State; t: T; action: Action }) {
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
      <div className="kpis">
        <Metric
          label={t("netLiquidation")}
          value={money(account.nlv, currency)}
        />
        <Metric label={t("daily")} value={money(risk.dailyPnl, currency)} />
        <Metric label={t("unrealized")} value={money(sum("pnl"), currency)} />
        <Metric
          label={t("heat")}
          value={`${percent(risk.heat)} / ${percent(scenario?.maxHeat)}`}
        />
      </div>
      <div className="dashboard-main">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t("equity")}</h2>
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
          />
        </section>
        <section className="panel">
          <h2>{t("risk")}</h2>
          <Badge status={risk.status} t={t} />
          <h3>{scenario?.name ?? t("noScenario")}</h3>
          <dl>
            <dt>{t("heat")}</dt>
            <dd>
              {percent(risk.heat)} / {percent(scenario?.maxHeat)}
            </dd>
            <dt>{t("drawdown")}</dt>
            <dd>
              {percent(risk.drawdowns.total)} /{" "}
              {percent(scenario?.totalDrawdown)}
            </dd>
            <dt>{t("margin")}</dt>
            <dd>{percent(risk.margin)}</dd>
            <dt>{t("liquidity")}</dt>
            <dd>{money(account.excessLiquidity, currency)}</dd>
            <dt>{t("buyingPower")}</dt>
            <dd>{money(account.buyingPower, currency)}</dd>
          </dl>
          {risk.riskIncreasingBlocked && (
            <p className="negative">{t("blocked")}</p>
          )}
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <h2>{t("allocation")}</h2>
          {Object.entries(risk.assets).map(([name, v]) => (
            <Exposure key={name} name={name} value={v} />
          ))}
          <Exposure
            name={t("cash")}
            value={
              account.cash && account.nlv
                ? (account.cash / account.nlv) * 100
                : 0
            }
          />
        </section>
        <section className="panel">
          <h2>{t("sector")}</h2>
          {Object.entries(risk.sectors).map(([name, v]) => (
            <Exposure
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
          {[...risk.rows]
            .sort((a, b) => (b.heat ?? -1) - (a.heat ?? -1))
            .slice(0, 5)
            .map((p) => (
              <div className="risk-row" key={p.id}>
                <b>{p.symbol}</b>
                <span>{money(p.value, currency)}</span>
                <span>{percent(p.heat)}</span>
              </div>
            ))}
        </section>
      </div>
      {account.alerts.filter((a) => !a.acknowledged).length > 0 && (
        <section className="panel">
          <h2>{t("alerts")}</h2>
          {account.alerts
            .filter((a) => !a.acknowledged)
            .slice(0, 10)
            .map((a) => (
              <div className="alert-row" key={a.id}>
                <Badge status={a.severity} t={t} />
                <span>{a.message}</span>
                <button
                  onClick={() =>
                    action("alert/ack", { id: a.id }).catch(() => {})
                  }
                >
                  {t("ack")}
                </button>
              </div>
            ))}
        </section>
      )}
    </>
  );
}
function Exposure({
  name,
  value,
  limit,
}: {
  name: string;
  value: number;
  limit?: number;
}) {
  return (
    <div className="exposure">
      <div>
        <span>{name}</span>
        <span>
          {percent(value)}
          {limit ? ` / ${percent(limit)}` : ""}
        </span>
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
