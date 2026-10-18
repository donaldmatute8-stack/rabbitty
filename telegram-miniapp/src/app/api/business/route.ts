import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { getAuthenticatedUser } from '@/lib/serverAuth';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function PATCH(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { rewardPercentage, businessId, name, description, address, category, logoUrl } = body;

    const ownerId = caller.id;

    // Verify ownership
    let business = null;
    if (businessId) {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, businessId),
      });
      if (business && business.ownerId !== ownerId && caller.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado para editar este negocio' }, { status: 403 });
      }
    }

    const whereClause = businessId
      ? eq(ownedBusinesses.id, businessId)
      : eq(ownedBusinesses.ownerId, ownerId);

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (rewardPercentage !== undefined) updateFields.rewardPercentage = parseInt(rewardPercentage);
    if (name !== undefined) updateFields.name = String(name).trim();
    if (description !== undefined) updateFields.description = String(description).trim();
    if (address !== undefined) updateFields.address = String(address).trim();
    if (category !== undefined) updateFields.category = String(category).trim();
    if (logoUrl !== undefined) updateFields.logoUrl = String(logoUrl).trim();

    const [updated] = await db.update(ownedBusinesses)
      .set(updateFields)
      .where(whereClause)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, business: updated, rewardPercentage: updated.rewardPercentage });
  } catch (error) {
    console.error('Business API PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, caller.id)
    });

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Business API GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json();
    const { 
      name, description, category, address, 
      rewardPercentage, gallery, activeDays, startTime, endTime, initData,
      googleClaimed, package: selectedPackage, creditLimit,
      lat: manualLat,
      lng: manualLng,
    } = body;

    // Resolve owner: prefer authenticated caller, fall back to Telegram initData.
    let owner = null;

    if (caller) {
      owner = await db.query.users.findFirst({ where: eq(users.id, caller.id) });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!owner && initData && botToken && validateTelegramInitData(initData, botToken)) {
      const tUser = parseTelegramUser(initData);
      if (tUser && tUser.id) {
        owner = await db.query.users.findFirst({
          where: eq(users.telegramId, tUser.id.toString())
        });
      }
    }

    if (!owner) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const lat = manualLat ?? (19.4326 + (Math.random() - 0.5) * 0.05);
    const lng = manualLng ?? (-99.1332 + (Math.random() - 0.5) * 0.05);

    const parsedReward = parseInt(rewardPercentage);
    let rarity = "common";
    if (parsedReward >= 15) rarity = "legendary";
    else if (parsedReward >= 10) rarity = "epic";
    else if (parsedReward >= 5) rarity = "rare";

    const isGoogleVerified = googleClaimed === true;

    const parsedCredit = parseInt(creditLimit) || 0;

    const [business] = await db.insert(ownedBusinesses).values({
      ownerId: owner.id,
      name,
      description,
      category,
      address,
      lat,
      lng,
      rewardPercentage: parsedReward,
      rarity,
      package: selectedPackage || null,
      creditLimit: parsedCredit,
      creditUsed: 0,
      activeDays: JSON.stringify(activeDays || [1,2,3,4,5,6,7]),
      startTime: startTime || "00:00",
      endTime: endTime || "23:59",
      gallery: JSON.stringify(gallery || []),
      logoUrl: gallery && gallery.length > 0 ? gallery[0] : null,
      status: isGoogleVerified ? "APPROVED" : "PENDING",
      verificationMethod: isGoogleVerified ? "google" : null,
      verificationData: isGoogleVerified ? JSON.stringify({ verified: true, claimedAt: new Date().toISOString() }) : null
    }).returning();

    if (TELEGRAM_BOT_TOKEN) {
      for (const adminId of ADMIN_TELEGRAM_IDS) {
        try {
          const payload: {
            chat_id: string;
            text: string;
            parse_mode: string;
            disable_web_page_preview: boolean;
            reply_markup?: {
              inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
            };
          } = {
            chat_id: adminId.trim(),
            text: `🆕 *Nuevo negocio registrado*\n\n*${name}*\n${category} — ${address}\nPaquete: ${selectedPackage || 'Sin paquete'} (${parsedCredit.toLocaleString()} Bunz)\nReward: ${parsedReward}%\nDueño: ${owner.firstName || '?'} (@${owner.username || '?'})\n\nEstado: ${isGoogleVerified ? '✅ Aprobado (Google)' : '⏳ Pendiente de verificación'}`,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          };

          if (!isGoogleVerified) {
            payload.reply_markup = {
              inline_keyboard: [
                [
                  { text: "✅ Aprobar Negocio", callback_data: `approve_biz_${business.id}` },
                  { text: "❌ Rechazar", callback_data: `reject_biz_${business.id}` },
                ]
              ]
            };
          }

          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
        } catch {}
      }
    }

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Business API POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
