"use client";
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
  const alerts =
    data.account?.alerts.filter((a) => a.active && !a.acknowledged) ?? [];
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="notification-trigger"
          aria-label={`${t("alerts")} (${alerts.length})`}
          title={t("alerts")}
        >
          <Bell size={19} />
          {alerts.length > 0 && (
            <span className="notification-count">{alerts.length}</span>
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
          <Dropdown.Label className="menu-label">
            {t("alerts")} · {alerts.length}
          </Dropdown.Label>
          {alerts.length === 0 && (
            <p className="empty-notifications">{t("noAlerts")}</p>
          )}
          {alerts.map((a) => {
            const live = data.risk?.violations.find((v) => v.key === a.key);
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
                onSelect={() =>
                  action("alert/ack", { id: a.id }, { silent: true }).catch(
                    () => {},
                  )
                }
              >
                <div>
                  <Badge status={a.severity} t={t} />
                  <p>
                    {live || values
                      ? riskAlertText(v, data.user.language)
                      : a.message}
                  </p>
                  <small>{t("ackHint")}</small>
                </div>
                <Check size={16} />
              </Dropdown.Item>
            );
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
