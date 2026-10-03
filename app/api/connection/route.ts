import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { accountFor } from "@/server/portfolio";
import { demoMode } from "@/server/db";
import { IBKRAdapter } from "@/broker/ibkr";
export const runtime = "nodejs";
const cache = new Map<string, { checkedAt: number; connected: boolean }>();
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await accountFor(user.id);
  if (demoMode() || account?.mode !== "live")
    return NextResponse.json({
      mode: "demo",
      connected: false,
      checkedAt: null,
    });
  if (account.brokerId !== process.env.IBKR_ACCOUNT_ID)
    return NextResponse.json({
      mode: "live",
      connected: false,
      checkedAt: Date.now(),
    });
  let result = cache.get(account.id);
  if (!result || Date.now() - result.checkedAt > 15000) {
    let connected = false;
    try {
      connected = await new IBKRAdapter().connectionStatus();
    } catch {
      /* Unavailable Gateway is a disconnected state. */
    }
    result = { connected, checkedAt: Date.now() };
    cache.set(account.id, result);
  }
  return NextResponse.json(
    { mode: "live", ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
