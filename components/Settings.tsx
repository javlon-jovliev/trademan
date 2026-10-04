"use client";
import { useState } from "react";
import type { State } from "./types";
import type { T, Action } from "./Platform";
import { DateTime } from "./DateTime";
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
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [sessionError, setSessionError] = useState("");
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
            aria-pressed={tab === k}
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
                  aria-label={t("theme")}
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
                  aria-label={t("baseCurrency")}
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
          </form>
          <div className="session-action">
            <button
              type="button"
              disabled={sessionBusy}
              onClick={async () => {
                setSessionBusy(true);
                setSessionNotice("");
                setSessionError("");
                try {
                  await action("sessions/revoke", {}, { silent: true });
                  setSessionNotice(t("sessionsDone"));
                } catch (e) {
                  setSessionError(
                    e instanceof TypeError
                      ? t("networkError")
                      : e instanceof Error
                        ? e.message
                        : String(e),
                  );
                } finally {
                  setSessionBusy(false);
                }
              }}
            >
              {t(sessionBusy ? "loading" : "revoke")}
            </button>
            {sessionNotice && (
              <p role="status" className="positive">
                {sessionNotice}
              </p>
            )}
            {sessionError && (
              <p role="alert" className="negative">
                {sessionError}
              </p>
            )}
          </div>
        </>
      )}
      {tab === "connections" && (
        <>
          <section className="connection-guide">
            <h3>{t("liveSetupTitle")}</h3>
            {data.demo && <p>{t("liveSetupHelp")}</p>}
            <ol>
              <li>{t("liveStep1")}</li>
              <li>{t("liveStep2")}</li>
              <li>{t("liveStep3")}</li>
            </ol>
            <a
              href="https://www.interactivebrokers.com/docs/web-api/authentication/cpgw/client-portal-gateway-faq"
              target="_blank"
              rel="noreferrer"
            >
              IBKR · Client Portal Gateway
            </a>
            <details>
              <summary>{t("setupDetails")}</summary>
              <pre>{`DEMO_MODE=false
IBKR_GATEWAY_URL=https://localhost:5000/v1/api
IBKR_ACCOUNT_ID=YOUR_ACCOUNT_ID
DATABASE_URL=YOUR_SEPARATE_LIVE_DATABASE
NODE_EXTRA_CA_CERTS=PATH_TO_TRUSTED_GATEWAY_CERTIFICATE`}</pre>
            </details>
          </section>
          <div className="connection">
            <h2>Interactive Brokers</h2>
            {data.account && (
              <>
                <p>
                  {data.account.brokerId} · {data.account.mode.toUpperCase()}
                </p>
                <p className="muted">
                  {t("lastSync")}:{" "}
                  {data.account.syncedAt ? (
                    <DateTime
                      value={data.account.syncedAt}
                      timeZone={data.account.timezone}
                      language={data.user.language}
                    />
                  ) : (
                    "—"
                  )}
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
            <section className="automatic-history">
              <h3>{t("automaticHistory")}</h3>
              <p className="muted">{t("automaticHistoryHelp")}</p>
              {data.demo ? (
                <p className="muted">{t("demoHistoryHelp")}</p>
              ) : (
                <>
                  <div className="automatic-sync-grid">
                    {(
                      [
                        [
                          "tradeHistory",
                          data.account.historySyncedAt,
                          data.account.historyError,
                        ],
                        [
                          "priceHistory",
                          data.account.barsSyncedAt,
                          data.account.barsError,
                        ],
                      ] as const
                    ).map(([key, at, error]) => (
                      <div key={key}>
                        <span>{t(key)}</span>
                        {at ? (
                          <DateTime
                            value={at}
                            timeZone={data.account!.timezone}
                            language={data.user.language}
                          />
                        ) : (
                          <small>{t("waitingSync")}</small>
                        )}
                        {error && (
                          <p className="negative">
                            {t(
                              key === "tradeHistory"
                                ? "historySetupNeeded"
                                : "pricesSetupNeeded",
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary>{t("setupDetails")}</summary>
                    <p className="muted">{t("flexSetupHelp")}</p>
                    <pre>
                      IBKR_FLEX_TOKEN=YOUR_FLEX_TOKEN{`\n`}
                      IBKR_FLEX_QUERY_ID=YOUR_QUERY_ID
                    </pre>
                  </details>
                </>
              )}
            </section>
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
