import { NextRequest } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from './telegramAuth';
import { getAuthenticatedUser } from './serverAuth';

// Allowlist SOLO desde env — sin defaults hardcodeados (un ID en el código no es un control).
// En producción: ADMIN_TELEGRAM_IDS debe configurarse explícitamente.
const ALLOWLIST = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_USERNAMES = ['deltoro', 'mardelbull'];
const ADMIN_EMAILS = ['marco.munoz9@gmail.com', 'admin@rabbitty.com'];

/**
 * Obtiene el telegramId verificado del admin.
 * SOLO initData firmado por Telegram (HMAC con bot token). El header
 * X-Telegram-Id es falsificable por cualquiera y JAMÁS autentica —
 * sin initData válido, no hay admin (período).
 */
export function getVerifiedAdminId(req: NextRequest): string | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null; // sin bot token NO HAY autenticación de admin

  const initData = req.headers.get('x-init-data') || '';
  if (!initData || !validateTelegramInitData(initData, botToken)) return null;

  const tg = parseTelegramUser(initData);
  return tg?.id != null ? String(tg.id) : null;
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
