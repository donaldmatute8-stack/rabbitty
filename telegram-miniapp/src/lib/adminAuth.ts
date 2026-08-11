import { NextRequest } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from './telegramAuth';

// Allowlist legacy solo como fallback de desarrollo. En producción debe venir
// de la variable de entorno ADMIN_TELEGRAM_IDS.
const ALLOWLIST = (process.env.ADMIN_TELEGRAM_IDS || '798431743')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Obtiene el telegramId verificado del admin.
 * En producción (TELEGRAM_BOT_TOKEN configurado) exige initData firmado por
 * Telegram: el header X-Telegram-Id es falsificable y no puede autenticar.
 * Sin bot token (desarrollo local) conserva el fallback legacy al header.
 */
export function getVerifiedAdminId(req: NextRequest): string | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken) {
    const initData = req.headers.get('x-init-data') || '';
    if (!initData || !validateTelegramInitData(initData, botToken)) return null;
    const tg = parseTelegramUser(initData);
    return tg?.id != null ? String(tg.id) : null;
  }

  return req.headers.get('X-Telegram-Id');
}

export function isAdminAllowed(tgId: string | null): boolean {
  return !!tgId && ALLOWLIST.includes(tgId);
}
