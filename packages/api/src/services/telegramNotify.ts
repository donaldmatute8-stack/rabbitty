/**
 * ── Avisos por Telegram (equipo Rabbitty) ───────────────────────────────────
 *
 * El bot vive en Railway (`TELEGRAM_BOT_TOKEN`). Para avisar al equipo hace
 * falta el chat destino (`GOD_TELEGRAM_CHAT_ID`), que es un id numérico, no el
 * id del bot: el bot no puede mandarse mensajes a sí mismo.
 *
 * Si falta cualquiera de los dos, la función devuelve false y no rompe el flujo
 * (la campana in-app y el push siguen funcionando).
 */

function botToken(): string {
  return String(process.env.TELEGRAM_BOT_TOKEN || process.env.AUTH_TELEGRAM_BOT_TOKEN || "");
}

export async function sendTelegramToChat(chatId: string | number | null | undefined, text: string): Promise<boolean> {
  const token = botToken();
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 3800),
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Aviso al equipo: usa `GOD_TELEGRAM_CHAT_ID` (id numérico del chat). */
export async function sendTelegramToGod(text: string): Promise<boolean> {
  const chatId = process.env.GOD_TELEGRAM_CHAT_ID;
  return sendTelegramToChat(chatId, text);
}
