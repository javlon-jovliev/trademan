"use client";
import { useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, Check } from "lucide-react";
import type { State } from "./types";
import { Badge, type T, type Action } from "./Platform";
import { riskAlertText } from "@/risk/messages";
export function Notifications({
  data,
  t,
  action,
}: {
  data: State;
  t: T;
  action: Action;
}) {
  const [filter, setFilter] = useState("unread");
  const [shown, setShown] = useState(10);
  const all = data.account?.alerts ?? [];
  const unread = all.filter((a) => a.active && !a.acknowledged);
  const read = all.filter((a) => a.acknowledged);
  const alerts = filter === "unread" ? unread : read;
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>
        <button
          className="notification-trigger"
          aria-label={`${t("alerts")} (${unread.length})`}
          title={t("alerts")}
        >
          <Bell size={19} />
          {unread.length > 0 && (
            <span className="notification-count">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="popover-menu notifications-menu"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <Dropdown.Label className="menu-label">{t("alerts")}</Dropdown.Label>
          <Dropdown.RadioGroup
            className="notification-tabs"
            value={filter}
            onValueChange={(value) => {
              setFilter(value);
              setShown(10);
            }}
          >
            <Dropdown.RadioItem
              className="menu-item"
              value="unread"
              onSelect={(e) => e.preventDefault()}
            >
              {t("unreadAlerts")} ({unread.length})
            </Dropdown.RadioItem>
            <Dropdown.RadioItem
              className="menu-item"
              value="read"
              onSelect={(e) => e.preventDefault()}
            >
              {t("readAlerts")} ({read.length})
            </Dropdown.RadioItem>
          </Dropdown.RadioGroup>
          {alerts.length === 0 && (
            <p className="empty-notifications">{t("noAlerts")}</p>
          )}
          {alerts.slice(0, shown).map((a) => {
            const live =
              !a.acknowledged && a.active
                ? data.risk?.violations.find((v) => v.key === a.key)
                : undefined;
            const values = a.message.match(
              /: ([\d.]+|unavailable) \/ ([\d.]+|—)/,
            );
            const v = live ?? {
              key: a.key,
              severity: a.severity as "warning" | "breach" | "unknown",
              value:
                values && values[1] !== "unavailable"
                  ? Number(values[1])
                  : null,
              limit: values && values[2] !== "—" ? Number(values[2]) : null,
            };
            return (
              <Dropdown.Item
                key={a.id}
                className="menu-item notification-item"
                onSelect={(e) => {
                  e.preventDefault();
                  if (!a.acknowledged)
                    action("alert/ack", { id: a.id }, { silent: true }).catch(
                      () => {},
                    );
                }}
              >
                <div>
                  <Badge status={a.severity} t={t} />
                  <p>
                    {live || values
                      ? riskAlertText(v, data.user.language)
                      : a.message}
                  </p>
                  <small>
                    {a.acknowledged ? t("readAlerts") : t("ackHint")} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString()}
                  </small>
                </div>
                <Check size={16} />
              </Dropdown.Item>
            );
          })}
          {alerts.length > shown && (
            <Dropdown.Item
              className="menu-item load-alerts"
              onSelect={(e) => {
                e.preventDefault();
                setShown((n) => n + 10);
              }}
            >
              {t("moreAlerts")} ({alerts.length - shown})
            </Dropdown.Item>
          )}
          {filter === "read" && (
            <p className="alert-history-help">{t("readAlertHelp")}</p>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
