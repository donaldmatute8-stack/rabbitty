import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEcosystemNotification } from '@/lib/push/notify';

export type TypingColumn = 'participant1TypingAt' | 'participant2TypingAt';

export interface ConversationAccess {
  myParticipantId: string;
  otherParticipantId: string;
  myTypingColumn: TypingColumn;
  otherTypingColumn: TypingColumn;
  isBusinessInbox: boolean;
}

export async function getOwnedBusinessIds(userId: string): Promise<string[]> {
  const rows = await db.query.ownedBusinesses
    .findMany({ where: eq(ownedBusinesses.ownerId, userId), columns: { id: true } })
    .catch(() => [] as { id: string }[]);
  return rows.map((r) => r.id);
}

export function resolveConversationAccess(
  conv: { participant1: string; participant2: string },
  userId: string,
  businessIds: string[],
): ConversationAccess | null {
  if (conv.participant1 === userId) {
    return {
      myParticipantId: conv.participant1,
      otherParticipantId: conv.participant2,
      myTypingColumn: 'participant1TypingAt',
      otherTypingColumn: 'participant2TypingAt',
      isBusinessInbox: false,
    };
  }
  if (conv.participant2 === userId) {
    return {
      myParticipantId: conv.participant2,
      otherParticipantId: conv.participant1,
      myTypingColumn: 'participant2TypingAt',
      otherTypingColumn: 'participant1TypingAt',
      isBusinessInbox: false,
    };
  }
  if (businessIds.includes(conv.participant1)) {
    return {
      myParticipantId: conv.participant1,
      otherParticipantId: conv.participant2,
      myTypingColumn: 'participant1TypingAt',
      otherTypingColumn: 'participant2TypingAt',
      isBusinessInbox: true,
    };
  }
  if (businessIds.includes(conv.participant2)) {
    return {
      myParticipantId: conv.participant2,
      otherParticipantId: conv.participant1,
      myTypingColumn: 'participant2TypingAt',
      otherTypingColumn: 'participant1TypingAt',
      isBusinessInbox: true,
    };
  }
  return null;
}

export function typingPatch(access: ConversationAccess): Partial<Record<TypingColumn, Date>> {
  const patch: Partial<Record<TypingColumn, Date>> = {};
  patch[access.myTypingColumn] = new Date();
  return patch;
}

export async function sendTelegramMessage(
  chatId: string | null | undefined,
  text: string,
  options?: { buttonUrl?: string; buttonText?: string },
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    };
    if (options?.buttonUrl) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: options.buttonText || 'Abrir Rabbitty', url: options.buttonUrl }]],
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TelegramRecipient {
  userId: string | null;
  telegramId: string | null;
  displayName: string;
}

export async function resolveTelegramRecipient(otherId: string): Promise<TelegramRecipient> {
  if (!otherId || otherId === 'bot') {
    return { userId: null, telegramId: null, displayName: 'Bunzy' };
  }
  const business = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, otherId) });
  if (business) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, business.ownerId) });
    return { userId: business.ownerId, telegramId: owner?.telegramId ?? null, displayName: business.name };
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, otherId) });
  return {
    userId: otherId,
    telegramId: user?.telegramId ?? null,
    displayName: user ? `${user.firstName || 'Explorador'} ${user.lastName || ''}`.trim() : 'Usuario',
  };
}

export function cleanMessagePreview(text: string, limit = 160): string {
  return (text || '')
    .replace(/\[[A-Z_]+[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

export async function notifyChatRecipient(params: {
  recipientUserId: string | null;
  recipientTelegramId: string | null;
  senderName: string;
  preview: string;
}): Promise<void> {
  const { recipientUserId, recipientTelegramId, senderName, preview } = params;
  const clean = cleanMessagePreview(preview) || 'Nuevo mensaje';
  if (recipientUserId) {
    await sendEcosystemNotification({
      userId: recipientUserId,
      title: `💬 ${senderName}`,
      message: clean,
      type: 'CHAT',
      route: '/chat',
      threadId: 'chat',
    });
  }
  if (recipientTelegramId) {
    const appUrl = process.env.RABBITTY_APP_URL || 'https://t.me/Rabbittyme_bot/app';
    await sendTelegramMessage(recipientTelegramId, `💬 ${senderName} te escribió:\n\n${clean}`, {
      buttonUrl: appUrl,
      buttonText: 'Responder en Rabbitty',
    });
  }
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isBusinessOpen(
  business: { activeDays?: string | null; startTime?: string | null; endTime?: string | null; timezone?: string | null },
  at: Date = new Date(),
): boolean {
  try {
    const tz = business.timezone || 'America/Mexico_City';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hourCycle: 'h23',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(at);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const current = Number(hour) * 60 + Number(minute);
    const dayIndex = WEEKDAY_TO_INDEX[weekday] ?? 1;

    let days: number[] = [1, 2, 3, 4, 5, 6, 7];
    try {
      const parsed = JSON.parse(business.activeDays || '[1,2,3,4,5,6,7]');
      if (Array.isArray(parsed)) days = parsed.map((d) => Number(d)).filter((d) => !Number.isNaN(d));
    } catch {
      days = [1, 2, 3, 4, 5, 6, 7];
    }
    if (!days.includes(dayIndex)) return false;

    const toMinutes = (value: string | null | undefined, fallback: number) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
      if (!m) return fallback;
      return Number(m[1]) * 60 + Number(m[2]);
    };
    const start = toMinutes(business.startTime, 0);
    const end = toMinutes(business.endTime, 24 * 60 - 1);

    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end;
  } catch {
    return true;
  }
}

export function formatBusinessHours(business: {
  activeDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const dayLabels: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
  let days: number[] = [];
  try {
    const parsed = JSON.parse(business.activeDays || '[]');
    if (Array.isArray(parsed)) days = parsed.map((d) => Number(d));
  } catch {
    days = [];
  }
  const dayText = days.length === 7 ? 'Todos los días' : days.map((d) => dayLabels[d] || '').filter(Boolean).join(', ');
  return `${dayText} · ${business.startTime || '00:00'}–${business.endTime || '23:59'}`;
}
