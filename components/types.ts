import type { Account, Scenario, Trade, Alert } from "@prisma/client";
import type { evaluate, Bar } from "@/risk/engine";
import type { ExecutionCosts } from "@/risk/costs";
export type ScenarioDTO = Omit<Scenario, "updatedAt"> & { updatedAt: string };
export type TradeDTO = Omit<Trade, "openedAt" | "closedAt" | "bars"> & {
  openedAt: string;
  closedAt: string;
  bars: Bar[];
};
export type UserDTO = {
  id: string;
  username: string;
  email: string;
  language: "uz" | "en";
  theme: "light" | "dark" | "system";
  timezone: string;
  baseCurrency: string;
  collapsed: boolean;
  telegramEnabled: boolean;
  telegramChatId: string | null;
};
export type State = {
  user: UserDTO;
  account:
    | (Omit<Account, "syncedAt" | "historySyncedAt" | "barsSyncedAt"> & {
        syncedAt: string | null;
        historySyncedAt: string | null;
        barsSyncedAt: string | null;
        scenarios: ScenarioDTO[];
        snapshots: { at: string; nlv: number }[];
        trades: TradeDTO[];
        alerts: Alert[];
      })
    | null;
  risk: ReturnType<typeof evaluate> | null;
  demo: boolean;
  stale: boolean;
  costs: ExecutionCosts | null;
};
