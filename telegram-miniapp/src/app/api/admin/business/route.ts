import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/db';
import { users, ownedBusinesses, webSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getVerifiedAdminId, isAdminAllowed } from '@/lib/adminAuth';
import { sendEcosystemNotification } from '@/lib/push/notify';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businesses = await db.query.ownedBusinesses.findMany({
    with: { owner: true },
    orderBy: (ob, { desc }) => [desc(ob.createdAt)],
  });

  return NextResponse.json({ success: true, businesses });
}

export async function POST(req: NextRequest) {
  const telegramId = getVerifiedAdminId(req);
  if (!isAdminAllowed(telegramId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { businessId, status, action, amount } = body;

  // Acción rápida de aprovisionamiento de Bunz (inventario) para comercios
  if (action === 'PROVISION_BUNZ' || status === 'PROVISION_BUNZ') {
    const bunzToAdd = Number(amount) || 3500;
    if (!businessId || bunzToAdd <= 0) {
      return NextResponse.json({ error: 'businessId y amount válidos requeridos' }, { status: 400 });
    }

    const currentBiz = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId),
    });
    if (!currentBiz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { sql } = await import('drizzle-orm');
    const [updated] = await db.update(ownedBusinesses)
      .set({
        bunzBalance: sql`"bunzBalance" + ${bunzToAdd}`,
      })
      .where(eq(ownedBusinesses.id, businessId))
      .returning();

    // Notificar al dueño si tiene Telegram
    const owner = updated.ownerId ? await db.query.users.findFirst({
      where: eq(users.id, updated.ownerId),
    }) : null;

    if (owner?.telegramId && TELEGRAM_BOT_TOKEN) {
      const msg =
        `🎉 *¡Bunz Aprovisionados con Éxito!*\n\n` +
        `Tu negocio *${updated.name}* ha recibido una carga de *+${bunzToAdd.toLocaleString()} BUNZ* para recompensar a tus clientes.\n\n` +
        `💰 *Nuevo Balance del Negocio:* ${updated.bunzBalance.toLocaleString()} BUNZ\n\n` +
        `🐰 — Rabbitty Team`;
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: owner.telegramId, text: msg, parse_mode: 'Markdown' }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, business: updated, bunzBalance: updated.bunzBalance });
  }

  if (!businessId || !['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const currentBiz = await db.query.ownedBusinesses.findFirst({
    where: eq(ownedBusinesses.id, businessId),
  });

  if (!currentBiz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  let existingVerificationData: Record<string, unknown> = {};
  try {
    if (currentBiz.verificationData) {
      existingVerificationData = JSON.parse(currentBiz.verificationData);
    }
  } catch {}

  const [updated] = await db.update(ownedBusinesses)
    .set({
      status,
      verificationMethod: 'admin',
      verificationData: JSON.stringify({
        ...existingVerificationData,
        updatedAt: new Date().toISOString(),
        updatedBy: telegramId,
      }),
    })
    .where(eq(ownedBusinesses.id, businessId))
    .returning();

  const owner = await db.query.users.findFirst({
    where: eq(users.id, updated.ownerId),
  });

  const targetEmail: string = String(owner?.email || existingVerificationData?.email || 'iaherrerav10@gmail.com');

  let magicUrl = 'https://admin.rabbitty.me/login';
  if (owner?.id) {
    try {
      const qrToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

      const [session] = await db.insert(webSessions).values({
        id: crypto.randomUUID(),
        jwtToken: tokenHash,
        userId: owner.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      magicUrl = `https://admin.rabbitty.me/magic?token=${qrToken}&sid=${session.id}`;
    } catch (e) {
      console.error('Failed to generate magic URL:', e);
    }
  }

  if (status === 'UNDER_REVIEW') {
    // Notificación Telegram si aplica
    if (owner?.telegramId && TELEGRAM_BOT_TOKEN) {
      const message =
        `🔍 *Tu negocio ${updated.name} está en Proceso de Revisión*\n\n` +
        `Nuestro equipo está validando los detalles de tu comercio para dejar todo listo.\n\n` +
        `🔑 *Puedes ir configurando tus productos y datos aquí:*\n` +
        `${magicUrl}\n\n` +
        `🐰 — Rabbitty Team`;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: owner.telegramId, text: message, parse_mode: 'Markdown' }),
        });
      } catch (e) {
        console.error('Failed to send under review Telegram msg:', e);
      }
    }

    // Correo Transaccional Neón "En Revisión"
    if (targetEmail) {
      try {
        const { sendEmail, wrapInRabbittyEmailLayout } = await import('@/lib/email');
        const content = `
          <div style="background: rgba(234,179,8,0.06); border-radius: 18px; padding: 22px; margin-bottom: 20px; border: 1px solid rgba(234,179,8,0.3);">
            <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
              Hola <strong>${updated.name}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
              Tu solicitud de registro ha pasado a nuestro estado prioritario <strong>"En Revisión"</strong>.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
              🕵️‍♂️ Un especialista de Rabbitty está revisando tu comercio. Mientras tanto, ya puedes ingresar a tu panel para configurar tu menú, catálogo y servicios.
            </p>
          </div>

          <div style="background: rgba(234,179,8,0.08); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(234,179,8,0.3); text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: #FFF; font-size: 16px; font-weight: 800;">🔑 Acceso Anticipado a tu Panel</h3>
            <p style="font-size: 13px; line-height: 1.6; color: #E2E8F0; margin: 0 0 18px 0;">
              Haz clic en el siguiente botón para iniciar sesión automáticamente y comenzar a llenar la información de tu negocio:
            </p>
            <a href="${magicUrl}" style="display: inline-block; background: #EAB308; color: #000; font-weight: 900; font-size: 14px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 14px rgba(234,179,8,0.3);">
              🚀 Ingresar a mi Panel de Administración
            </a>
          </div>

          <div style="background: linear-gradient(135deg, rgba(234,179,8,0.12), rgba(244,63,94,0.12)); border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(234,179,8,0.25);">
            <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 15px; font-weight: 800;">💬 ¿Necesitas agilizar tu verificación?</h3>
            <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px;">Escríbenos directamente en nuestro canal de atención a afiliados.</p>
            <a href="https://t.me/Rabbittyme_bot" style="display: inline-block; background: rgba(255,255,255,0.1); color: #FFF; font-weight: 800; font-size: 13px; padding: 12px 24px; border-radius: 12px; text-decoration: none; border: 1px solid rgba(255,255,255,0.2);">Hablar con Soporte 📲</a>
          </div>
        `;
        const emailHtml = wrapInRabbittyEmailLayout(`Solicitud En Revisión 🔍`, updated.name, content);
        await sendEmail({
          to: targetEmail,
          subject: `🔍 Tu negocio ${updated.name} está en revisión (Acceso a tu Panel)`,
          html: emailHtml,
        });
      } catch (e) {
        console.error('Failed to send under review email:', e);
      }
    }
  }

  if (status === 'APPROVED') {
    let magicUrl = 'https://admin.rabbitty.me/login';

    if (owner?.id) {
      const qrToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

      const [session] = await db.insert(webSessions).values({
        id: crypto.randomUUID(),
        jwtToken: tokenHash,
        userId: owner.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      magicUrl = `https://admin.rabbitty.me/magic?token=${qrToken}&sid=${session.id}`;
    }

    // Notificación vía Telegram (si tiene telegramId)
    if (owner?.telegramId && TELEGRAM_BOT_TOKEN) {
      const message =
        `🎉 *¡Felicidades! Tu negocio ${updated.name} ha sido aprobado.*\n\n` +
        `Ya estás listo para operar en Rabbitty. Tus clientes pueden escanear y ganar Bunz.\n\n` +
        `🔗 *Panel de Administración:*\n` +
        `https://admin.rabbitty.me/login\n\n` +
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

    // Notificación Push & In-App al dueño del negocio
    if (owner?.id) {
      await sendEcosystemNotification({
        userId: owner.id,
        title: `🎉 ¡Negocio Aprobado: ${updated.name}!`,
        message: `Tu comercio ya está activo en Rabbitty. Tus clientes ya pueden escanear y ganar Bunz.`,
        type: 'AFFILIATE',
        route: '/business',
        pushData: { businessId: updated.id, status: 'APPROVED' },
        threadId: 'business_status',
      });
    }

    // Notificación vía Correo Electrónico
    if (targetEmail) {
      try {
        const { sendEmail, getApplicationApprovedEmailTemplate } = await import('@/lib/email');
        const emailRes = await sendEmail({
          to: targetEmail,
          subject: `🎉 ¡Felicidades! Tu negocio ${updated.name} fue aprobado en Rabbitty`,
          html: getApplicationApprovedEmailTemplate(updated.name, magicUrl),
        });
        console.log('[Admin Approval Email Result]:', emailRes);
      } catch (e) {
        console.error('Failed to send approval email:', e);
      }
    }
  }

  if (status === 'REJECTED') {
    // Notificación Push & In-App al dueño del negocio
    if (owner?.id) {
      await sendEcosystemNotification({
        userId: owner.id,
        title: `⚠️ Solicitud de Negocio: ${updated.name}`,
        message: `Tu solicitud necesita ajustes para ser aprobada. Revisa los detalles en el soporte.`,
        type: 'AFFILIATE',
        route: '/support',
        pushData: { businessId: updated.id, status: 'REJECTED' },
        threadId: 'business_status',
      });
    }

    // Notificación Telegram si aplica
    if (owner?.telegramId && TELEGRAM_BOT_TOKEN) {
      const message =
        `❌ *Solicitud Rechazada para ${updated.name}*\n\n` +
        `Lamentablemente tu solicitud de registro de negocio no ha cumplido con los criterios de aprobación en este momento.\n\n` +
        `Si crees que esto es un error, por favor contacta a soporte.\n\n` +
        `🐰 — Rabbitty Team`;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: owner.telegramId, text: message, parse_mode: 'Markdown' }),
        });
      } catch (e) {
        console.error('Failed to send rejection Telegram msg:', e);
      }
    }

    // Correo Transaccional Neón "Rechazado"
    if (targetEmail) {
      try {
        const { sendEmail, wrapInRabbittyEmailLayout } = await import('@/lib/email');
        const content = `
          <div style="background: rgba(244,63,94,0.06); border-radius: 18px; padding: 22px; margin-bottom: 24px; border: 1px solid rgba(244,63,94,0.3);">
            <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">
              Hola <strong>${updated.name}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">
              Lamentamos informarte que tu solicitud de registro de negocio <strong>ha sido rechazada</strong>.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">
              🕵️‍♂️ Tu negocio no cumple con los criterios de aprobación en este momento.
            </p>
          </div>
          <div style="background: linear-gradient(135deg, rgba(234,179,8,0.12), rgba(244,63,94,0.12)); border-radius: 18px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(234,179,8,0.25);">
            <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 15px; font-weight: 800;">💬 ¿Crees que es un error?</h3>
            <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px;">Comunícate con soporte para apelar esta decisión.</p>
            <a href="https://t.me/Rabbittyme_bot" style="display: inline-block; background: #EAB308; color: #000; font-weight: 900; font-size: 13px; padding: 12px 26px; border-radius: 12px; text-decoration: none;">Hablar con Soporte 📲</a>
          </div>
        `;
        const emailHtml = wrapInRabbittyEmailLayout(`Solicitud Rechazada ❌`, updated.name, content);
        await sendEmail({
          to: targetEmail,
          subject: `❌ Tu solicitud para ${updated.name} ha sido rechazada en Rabbitty`,
          html: emailHtml,
        });
      } catch (e) {
        console.error('Failed to send rejection email:', e);
      }
    }
  }

  return NextResponse.json({ success: true, business: updated });
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    if (!data.negocio && !data.nombre) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const existing = data.negocio ? await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.name, data.negocio)
    }) : null;

    if (!existing) {
      const [inserted] = await db.insert(ownedBusinesses).values({
        id: crypto.randomUUID(),
        ownerId: 'f7178385-0010-4000-8000-000000000001',
        name: data.negocio || 'Nuevo Negocio',
        category: data.tipo || 'Restaurante',
        description: data.mensaje || 'Solicitud de afiliación recibida desde la landing page rabbitty.me',
        address: data.ubicacion || 'Por confirmar',
        lat: 19.4326,
        lng: -99.1332,
        rewardPercentage: 10,
        status: 'PENDING',
        verificationMethod: 'web_form',
        verificationData: JSON.stringify(data),
      }).returning();

      return NextResponse.json({ success: true, business: inserted });
    }

    return NextResponse.json({ success: true, message: 'Already exists' });
  } catch (e) {
    console.error('[PUT /api/admin/business error]:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
