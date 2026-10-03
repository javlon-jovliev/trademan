"use client";
import Link from "next/link";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  CircleCheck,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { State } from "./types";
import { Badge, percent, type T, type Action } from "./Platform";
import type { Key } from "@/i18n/dictionaries";
import { scenarioSchema } from "@/server/validation";
export function Scenarios({
  data,
  t,
  action,
}: {
  data: State;
  t: T;
  action: Action;
}) {
  return (
    <section className="panel table-panel">
      <div className="toolbar">
        <Link className="button primary" href="/scenarios/new">
          + {t("newScenario")}
        </Link>
      </div>
      <div className="table-scroll">
        <table className="scenario-table">
          <thead>
            <tr>
              {[
                "name",
                "active",
                "maxHeat",
                "maxTradeRisk",
                "totalDrawdown",
              ].map((k) => (
                <th key={k}>{t(k as Key)}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {data.account?.scenarios.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/scenarios/${s.id}`}>
                    <b>{s.name}</b>
                  </Link>
                  <small>{s.description}</small>
                </td>
                <td>
                  <Badge
                    status={
                      s.id === data.account?.activeScenarioId
                        ? "active"
                        : s.draft
                          ? "draft"
                          : "inactive"
                    }
                    t={t}
                  />
                </td>
                {[s.maxHeat, s.maxTradeRisk, s.totalDrawdown].map((v, i) => (
                  <td key={i}>{percent(v)}</td>
                ))}
                <td>
                  <Dropdown.Root modal={false}>
                    <Dropdown.Trigger asChild>
                      <button
                        className="icon-button"
                        aria-label={`${t("details")} · ${s.name}`}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </Dropdown.Trigger>
                    <Dropdown.Portal>
                      <Dropdown.Content
                        className="popover-menu"
                        align="end"
                        sideOffset={6}
                        collisionPadding={12}
                      >
                        <Dropdown.Item
                          className="menu-item"
                          disabled={
                            s.draft || s.id === data.account?.activeScenarioId
                          }
                          onSelect={() =>
                            action("scenario/activate", { id: s.id }).catch(
                              () => {},
                            )
                          }
                        >
                          <CircleCheck size={16} />
                          {t("activate")}
                        </Dropdown.Item>
                        <Dropdown.Item className="menu-item" asChild>
                          <Link href={`/scenarios/${s.id}`}>
                            <Pencil size={16} />
                            {t("edit")}
                          </Link>
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="menu-item"
                          onSelect={() =>
                            action("scenario/duplicate", { id: s.id }).catch(
                              () => {},
                            )
                          }
                        >
                          <Copy size={16} />
                          {t("duplicate")}
                        </Dropdown.Item>
                        <Dropdown.Separator className="menu-separator" />
                        <Dropdown.Item
                          className="menu-item negative"
                          disabled={s.id === data.account?.activeScenarioId}
                          onSelect={() => {
                            if (confirm(t("confirmDelete")))
                              action("scenario/delete", { id: s.id }).catch(
                                () => {},
                              );
                          }}
                        >
                          <Trash2 size={16} />
                          {t("remove")}
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Portal>
                  </Dropdown.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.account?.scenarios.length && (
        <p className="empty">{t("noData")}</p>
      )}
    </section>
  );
}
const defaults = {
  name: "",
  description: "",
  draft: false,
  maxHeat: 6,
  warningHeat: 4.5,
  maxTradeRisk: 1.5,
  maxPosition: 20,
  maxGross: 150,
  maxNet: 100,
  maxMargin: 65,
  minLiquidity: 25,
  dailyLoss: 2,
  weeklyLoss: 4,
  monthlyLoss: 6,
  totalDrawdown: 8,
  sectorLimit: 35,
  sectorLimits: {},
  assetLimits: {},
  requireStops: true,
  alertEnabled: true,
  warningPercent: 80,
};
export function ScenarioEditor({
  data,
  t,
  action,
  id,
}: {
  data: State;
  t: T;
  action: Action;
  id: string;
}) {
  const existing = data.account?.scenarios.find((s) => s.id === id);
  const [form, setForm] = useState({ ...defaults, ...existing });
  const [tab, setTab] = useState<Key>("basic");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sectorText, setSectorText] = useState(
    formatLimits(existing?.sectorLimits),
  );
  const [assetText, setAssetText] = useState(
    formatLimits(existing?.assetLimits),
  );
  const router = useRouter();
  if (id !== "new" && !existing) return <p>{t("noData")}</p>;
  const fields: Partial<Record<Key, Key[]>> = {
    riskTab: [
      "maxHeat",
      "warningHeat",
      "maxTradeRisk",
      "dailyLoss",
      "weeklyLoss",
      "monthlyLoss",
      "totalDrawdown",
    ],
    allocationTab: [
      "maxPosition",
      "maxGross",
      "maxNet",
      "maxMargin",
      "minLiquidity",
    ],
    sectorsTab: ["sectorLimit"],
    alertsTab: ["warningPercent"],
  };
  return (
    <form
      className="panel scenario-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
          const parsed = scenarioSchema.parse({
            ...form,
            sectorLimits: parseLimits(sectorText),
            assetLimits: parseLimits(assetText),
          });
          await action("scenario/save", { id: existing?.id, scenario: parsed });
          router.push("/scenarios");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="panel-heading">
        <h2>{existing?.name ?? t("newScenario")}</h2>
        <div className="row-actions">
          <Link href="/scenarios">{t("cancel")}</Link>
          <button className="primary" disabled={saving}>
            {t(saving ? "loading" : "save")}
          </button>
        </div>
      </div>
      <div className="tabs">
        {(
          [
            "basic",
            "riskTab",
            "allocationTab",
            "sectorsTab",
            "alertsTab",
          ] as Key[]
        ).map((k) => (
          <button
            type="button"
            key={k}
            aria-pressed={tab === k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      <div className="form-grid">
        {tab === "basic" && (
          <>
            <label>
              {t("name")}
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              {t("description")}
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.draft}
                disabled={existing?.id === data.account?.activeScenarioId}
                onChange={(e) => setForm({ ...form, draft: e.target.checked })}
              />
              {t("draft")}
            </label>
          </>
        )}
        {fields[tab]?.map((k) => (
          <label key={k}>
            {t(k)}
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={k === "maxGross" || k === "maxNet" ? 1000 : 100}
              value={String(form[k as keyof typeof form])}
              onChange={(e) =>
                setForm({ ...form, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        {tab === "riskTab" && (
          <label className="check">
            <input
              type="checkbox"
              checked={form.requireStops}
              onChange={(e) =>
                setForm({ ...form, requireStops: e.target.checked })
              }
            />
            {t("requireStops")}
          </label>
        )}
        {tab === "sectorsTab" && (
          <label>
            {t("sectorLimits")}
            <textarea
              value={sectorText}
              placeholder="Technology=35"
              onChange={(e) => setSectorText(e.target.value)}
            />
            <small>{t("limitsHelp")}</small>
          </label>
        )}
        {tab === "allocationTab" && (
          <label>
            {t("assetLimits")}
            <textarea
              value={assetText}
              placeholder="STK=80"
              onChange={(e) => setAssetText(e.target.value)}
            />
            <small>{t("limitsHelp")}</small>
          </label>
        )}
        {tab === "alertsTab" && (
          <label className="check">
            <input
              type="checkbox"
              checked={form.alertEnabled}
              onChange={(e) =>
                setForm({ ...form, alertEnabled: e.target.checked })
              }
            />
            {t("alertEnabled")}
          </label>
        )}
      </div>
    </form>
  );
}
function formatLimits(v: unknown) {
  return v
    ? Object.entries(v as Record<string, number>)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";
}
function parseLimits(text: string) {
  return Object.fromEntries(
    text
      .split("\n")
      .filter((s) => s.trim())
      .map((s) => {
        const [key, value] = s.split("=");
        if (!key?.trim() || !value || !Number.isFinite(Number(value)))
          throw Error("Invalid limit: " + s);
        return [key.trim(), Number(value)];
      }),
  );
}
