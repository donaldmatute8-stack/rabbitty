import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET(req: Request) {
  const telegramId = req.headers.get('X-Telegram-Id');
  if (!telegramId || !ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businesses = await db.query.ownedBusinesses.findMany({
    with: { owner: true },
    orderBy: (ob, { desc }) => [desc(ob.createdAt)],
  });

  return NextResponse.json({ success: true, businesses });
}

export async function POST(req: Request) {
  const telegramId = req.headers.get('X-Telegram-Id');
  if (!telegramId || !ADMIN_TELEGRAM_IDS.includes(telegramId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { businessId, status } = await req.json();
  if (!businessId || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const [updated] = await db.update(ownedBusinesses)
    .set({
      status,
      verificationMethod: 'admin',
      verificationData: JSON.stringify({ approvedAt: new Date().toISOString(), approvedBy: telegramId }),
    })
    .where(eq(ownedBusinesses.id, businessId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  if (status === 'APPROVED') {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, updated.ownerId),
    });

    let magicUrl = 'https://admin.rabbitty.me';

    if (owner?.telegramId || owner?.email) {
      const qrToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

      const [session] = await db.insert(webSessions).values({
        id: crypto.randomUUID(),
        jwtToken: tokenHash,
        userId: owner.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      magicUrl = `https://admin.rabbitty.me/magic?token=${qrToken}&sid=${session.id}`;

      // Notificación vía Telegram (si tiene telegramId)
      if (owner?.telegramId && TELEGRAM_BOT_TOKEN) {
        const message =
          `🎉 *¡Felicidades! Tu negocio ${updated.name} ha sido aprobado.*\n\n` +
          `Ya estás listo para operar en Rabbitty. Tus clientes pueden escanear y ganar Bunz.\n\n` +
          `🔗 *Panel de Administración:*\n` +
          `https://admin.rabbitty.me\n\n` +
          `🔑 *Tu enlace mágico (un solo clic):*\n` +
          `${magicUrl}\n\n` +
          `Este enlace te conecta automáticamente. No lo compartas.\n\n` +
          `🐰 — Rabbitty Team`;

        try {
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: owner.telegramId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
              }),
            }
          );
        } catch (e) {
          console.error('Failed to send approval notification:', e);
        }
      }

      // Notificación vía Correo Electrónico (si tiene correo registrado)
      if (owner?.email) {
        try {
          const { sendEmail, getApplicationApprovedEmailTemplate } = await import('@/lib/email');
          await sendEmail({
            to: owner.email,
            subject: `🎉 ¡Felicidades! Tu negocio ${updated.name} fue aprobado en Rabbitty`,
            html: getApplicationApprovedEmailTemplate(updated.name, magicUrl),
          });
        } catch (e) {
          console.error('Failed to send approval email:', e);
        }
      }
    }
  }

  return NextResponse.json({ success: true, business: updated });
}
