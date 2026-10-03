"use client";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronUp, Globe, LogOut } from "lucide-react";
import type { State } from "./types";
import type { T } from "./Platform";
export function AccountMenu({
  user,
  t,
  onLanguage,
  onLogout,
}: {
  user: State["user"];
  t: T;
  onLanguage: (language: "uz" | "en") => void;
  onLogout: () => void;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="account-trigger"
          aria-label={t("accountMenu")}
          title={t("accountMenu")}
        >
          <span className="avatar">{user.username[0].toUpperCase()}</span>
          <span className="account-name">{user.username}</span>
          <ChevronUp className="account-chevron" size={16} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="popover-menu account-menu"
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
        >
          <Dropdown.Label className="menu-label">
            {user.username}
          </Dropdown.Label>
          <Dropdown.Label className="menu-label">
            <Globe size={14} />
            {t("language")}
          </Dropdown.Label>
          <Dropdown.RadioGroup
            value={user.language}
            onValueChange={(v) => onLanguage(v as "uz" | "en")}
          >
            <Dropdown.RadioItem className="menu-item" value="uz">
              O‘zbekcha
              <Dropdown.ItemIndicator aria-hidden="true">
                ✓
              </Dropdown.ItemIndicator>
            </Dropdown.RadioItem>
            <Dropdown.RadioItem className="menu-item" value="en">
              English
              <Dropdown.ItemIndicator aria-hidden="true">
                ✓
              </Dropdown.ItemIndicator>
            </Dropdown.RadioItem>
          </Dropdown.RadioGroup>
          <Dropdown.Separator className="menu-separator" />
          <Dropdown.Item className="menu-item negative" onSelect={onLogout}>
            <LogOut size={16} />
            {t("logout")}
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
