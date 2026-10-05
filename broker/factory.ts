import { IBKRAdapter } from "./ibkr";
import { TWSAdapter } from "./tws";
import type { BrokerAdapter } from "./types";

// Explicit selection: never switch broker sessions silently after an error.
export function createBrokerAdapter(): BrokerAdapter {
  const adapter = process.env.IBKR_ADAPTER ?? "web";
  if (adapter === "web") return new IBKRAdapter();
  if (adapter === "tws") return new TWSAdapter();
  throw Error("IBKR_ADAPTER must be web or tws");
}
