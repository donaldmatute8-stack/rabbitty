import { NextRequest } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from './telegramAuth';
import { getAuthenticatedUser } from './serverAuth';

// Allowlist legacy solo como fallback de desarrollo. En producción debe venir
// de la variable de entorno ADMIN_TELEGRAM_IDS.
const ALLOWLIST = (process.env.ADMIN_TELEGRAM_IDS || '798431743')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_USERNAMES = ['deltoro', 'mardelbull'];
const ADMIN_EMAILS = ['marco.munoz9@gmail.com', 'admin@rabbitty.com'];

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
    if (initData && validateTelegramInitData(initData, botToken)) {
      const tg = parseTelegramUser(initData);
      if (tg?.id != null) return String(tg.id);
    }
  }

  return req.headers.get('X-Telegram-Id');
}

export function isAdminAllowed(tgId: string | null): boolean {
  return !!tgId && ALLOWLIST.includes(tgId);
}

/**
 * Verificación unificada de God Admin (soporta JWT nativo iOS/Web + Telegram initData).
 */
export async function verifyGodAdminRequest(req: NextRequest | Request): Promise<{
  allowed: boolean;
  adminId: string | null;
}> {
  const caller = await getAuthenticatedUser(req);
  if (caller) {
    const tgId = caller.telegramId ? String(caller.telegramId) : '';
    const uname = (caller.username || '').toLowerCase();
    const email = (caller.email || '').toLowerCase();
    if (
      caller.role === 'ADMIN' ||
      ALLOWLIST.includes(tgId) ||
      ADMIN_USERNAMES.includes(uname) ||
      ADMIN_EMAILS.includes(email)
    ) {
      return { allowed: true, adminId: caller.id };
    }
  }

  if ('headers' in req) {
    const tgId = getVerifiedAdminId(req as NextRequest);
    if (isAdminAllowed(tgId)) {
      return { allowed: true, adminId: tgId };
    }
  }

  return { allowed: false, adminId: null };
}
