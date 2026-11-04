/**
 * ── Invitar / contactar ── flujo unificado SIN plugin nativo de contactos.
 *
 * Orden de preferencia:
 *   1. Hoja de compartir NATIVA (iOS/Android): ahí el usuario elige WhatsApp,
 *      Telegram, Mensajes, correo… y el sistema se encarga de los permisos.
 *   2. Web Share API (navegador moderno).
 *   3. Enlaces directos: WhatsApp (wa.me) y Telegram (t.me/share).
 *
 * Por qué así y no leyendo la agenda: importar contactos exige un plugin nuevo
 * + permiso + subir hashes al servidor. Compartir por WhatsApp/Telegram cubre
 * el 90 % del caso real (invitar a alguien) sin dependencias ni preguntas de
 * App Review. El matching automático de agenda queda para cuando exista la
 * feature completa.
 */

import { PlatformBridge } from '@/lib/platform';

const INVITE_TEXT = '¡Qué onda! Únete a Rabbitty: gana Bunz en tus lugares favoritos 🐰';

export interface InviteContext {
  username?: string | null;
  telegramId?: string | null;
  id?: string | null;
}

export function buildInviteLink(ctx: InviteContext): string {
  const code = ctx.username || ctx.telegramId || ctx.id || 'rabbitty';
  return PlatformBridge.getShareableLink(
    `/download?ref=${encodeURIComponent(code)}`,
    `ref_${ctx.telegramId || code}`,
  );
}

/** Hoja nativa primero; devuelve false si el usuario canceló o no hay soporte. */
export async function shareInvite(ctx: InviteContext): Promise<boolean> {
  const link = buildInviteLink(ctx);
  try {
    return await PlatformBridge.share({
      title: 'Rabbitty',
      text: INVITE_TEXT,
      url: link,
      dialogTitle: 'Invitar a Rabbitty',
    });
  } catch {
    return false;
  }
}

export function whatsappInviteUrl(ctx: InviteContext): string {
  const link = buildInviteLink(ctx);
  return `https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT} ${link}`)}`;
}

export function telegramInviteUrl(ctx: InviteContext): string {
  const link = buildInviteLink(ctx);
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(INVITE_TEXT)}`;
}

/** Abre el canal elegido (WhatsApp/Telegram) con el mensaje ya escrito. */
export function openInviteChannel(channel: 'whatsapp' | 'telegram', ctx: InviteContext): void {
  PlatformBridge.hapticFeedback('medium');
  const url = channel === 'whatsapp' ? whatsappInviteUrl(ctx) : telegramInviteUrl(ctx);
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
  if (channel === 'telegram' && tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  window.open(url, '_blank');
}
