"use client";
import { useState } from "react";
import type { State } from "./types";
import type { T, Action } from "./Platform";
import type { Key } from "@/i18n/dictionaries";
export function SettingsPage({
  data,
  t,
  action,
}: {
  data: State;
  t: T;
  action: Action;
}) {
  const [tab, setTab] = useState<Key>("accountTab");
  const [form, setForm] = useState({
    ...data.user,
    telegramChatId: data.user.telegramChatId ?? "",
  });
  return (
    <section className="panel settings">
      <div className="tabs">
        {(["accountTab", "connections", "notifications"] as Key[]).map((k) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {tab === "accountTab" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("settings", {
                ...form,
                language: data.user.language,
                collapsed: data.user.collapsed,
              }).catch(() => {});
            }}
          >
            <div className="form-grid">
              {(["username", "email", "timezone"] as const).map((k) => (
                <label key={k}>
                  {t(k)}
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    required
                    type={k === "email" ? "email" : "text"}
                  />
                </label>
              ))}
              <label>
                {t("theme")}
                <select
                  value={form.theme}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      theme: e.target.value as typeof form.theme,
                    })
                  }
                >
                  {(["light", "dark", "system"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("baseCurrency")}
                <select
                  value={form.baseCurrency}
                  onChange={(e) =>
                    setForm({ ...form, baseCurrency: e.target.value })
                  }
                >
                  {["USD", "EUR", "GBP"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary">{t("save")}</button>
          </form>
          <hr />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const element = e.currentTarget;
              const f = new FormData(element);
              await action("password", Object.fromEntries(f))
                .then(() => element.reset())
                .catch(() => {});
            }}
          >
            <div className="form-grid">
              <label>
                {t("currentPassword")}
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                {t("newPassword")}
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            <button>{t("changePassword")}</button>{" "}
            <button
              type="button"
              onClick={() => action("sessions/revoke", {}).catch(() => {})}
            >
              {t("revoke")}
            </button>
          </form>
        </>
      )}
      {tab === "connections" && (
        <>
          <div className="connection">
            <h2>Interactive Brokers</h2>
            {data.account && (
              <>
                <p>
                  {data.account.brokerId} · {data.account.mode.toUpperCase()}
                </p>
                <p className="muted">
                  {t("lastSync")}:{" "}
                  {data.account.syncedAt
                    ? new Date(data.account.syncedAt).toLocaleString()
                    : "—"}
                </p>
                {data.account.syncError && (
                  <p className="negative">{data.account.syncError}</p>
                )}
                <button
                  className="primary"
                  onClick={() => action("sync", {}).catch(() => {})}
                >
                  {t("sync")}
                </button>
                {!data.demo && (
                  <button
                    className="negative"
                    onClick={() => {
                      if (confirm(t("confirmDisconnect")))
                        action("connections/delete", {}).catch(() => {});
                    }}
                  >
                    {t("remove")}
                  </button>
                )}
              </>
            )}
            {!data.demo && !data.account && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action(
                    "connections/add",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ).catch(() => {});
                }}
              >
                <label>
                  {t("brokerAccount")}
                  <input name="brokerId" required />
                </label>
                <button className="primary">{t("connect")}</button>
              </form>
            )}
          </div>
          {data.account && !data.demo && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action("account/flow", {
                  amount: Number(new FormData(e.currentTarget).get("amount")),
                }).catch(() => {});
              }}
            >
              <label>
                {t("flow")}
                <input name="amount" type="number" step="any" required />
              </label>
              <small>{t("flowHelp")}</small>
              <button>{t("recordFlow")}</button>
            </form>
          )}
          {data.account && (
            <div className="imports">
              {!data.demo && (
                <>
                  <button
                    onClick={() => action("history/sync", {}).catch(() => {})}
                  >
                    IBKR Flex · {t("sync")}
                  </button>
                  <button
                    onClick={() =>
                      action("history/bars-sync", {}).catch(() => {})
                    }
                  >
                    OHLC · {t("sync")}
                  </button>
                  {data.account?.historyError && (
                    <p className="negative">{data.account.historyError}</p>
                  )}
                </>
              )}
              <label>
                {t("importTrades")}
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const csv = await file.text();
                    action("history/import", { csv }).catch(() => {});
                  }}
                />
              </label>
              <small>{t("importHelp")}</small>
              <label>
                OHLC CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    action("history/bars", { csv: await file.text() }).catch(
                      () => {},
                    );
                  }}
                />
              </label>
              <small>symbol,time,open,high,low,close</small>
            </div>
          )}
        </>
      )}
      {tab === "notifications" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action("settings", {
              ...form,
              language: data.user.language,
              collapsed: data.user.collapsed,
            }).catch(() => {});
          }}
        >
          <label className="check">
            <input
              type="checkbox"
              checked={form.telegramEnabled}
              onChange={(e) =>
                setForm({ ...form, telegramEnabled: e.target.checked })
              }
            />
            {t("telegramEnabled")}
          </label>
          <label>
            {t("telegramChatId")}
            <input
              value={form.telegramChatId}
              onChange={(e) =>
                setForm({ ...form, telegramChatId: e.target.value })
              }
            />
          </label>
          <div className="row-actions">
            <button className="primary">{t("save")}</button>
            <button
              type="button"
              onClick={() => action("telegram/test", {}).catch(() => {})}
            >
              {t("testTelegram")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
