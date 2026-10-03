export async function sendTelegram(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw Error("Telegram bot token is not configured");
  if (!/^-?\d+$/.test(chatId)) throw Error("Invalid Telegram chat ID");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 4000) }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await r.json();
  if (!r.ok || body.ok !== true) throw Error("Telegram delivery failed");
}
