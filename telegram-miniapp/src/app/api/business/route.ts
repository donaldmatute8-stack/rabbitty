import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { telegramId, rewardPercentage } = body;

    if (!telegramId || rewardPercentage === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId.toString()),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [updated] = await db.update(ownedBusinesses)
      .set({ rewardPercentage: parseInt(rewardPercentage) })
      .where(eq(ownedBusinesses.ownerId, user.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, rewardPercentage: updated.rewardPercentage });
  } catch (error) {
    console.error('Business API PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    const telegramId = searchParams.get('telegramId');

    if (!wallet && !telegramId) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 });
    }

    let user;
    if (telegramId) {
      user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId)
      });
    } else if (wallet) {
      user = await db.query.users.findFirst({
        where: eq(users.tonWalletAddress, wallet)
      });
    }

    if (!user) {
      return NextResponse.json({ success: true, business: null });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, user.id)
    });

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Business API GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name, description, category, address, 
      rewardPercentage, gallery, activeDays, startTime, endTime, initData,
      googleClaimed, package: selectedPackage, creditLimit,
      lat: manualLat,
      lng: manualLng,
    } = body;

    // Validate initData
    if (!initData) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && !validateTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Invalid user data' }, { status: 401 });
    }

    // Only allow real users as owners
    const owner = await db.query.users.findFirst({
      where: eq(users.telegramId, tUser.id.toString())
    });

    if (!owner) {
      return NextResponse.json({ error: 'User not registered. Please start the bot first.' }, { status: 400 });
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
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: adminId.trim(),
                text: `🆕 *Nuevo negocio registrado*\n\n*${name}*\n${category} — ${address}\nPaquete: ${selectedPackage || 'Sin paquete'} (${parsedCredit.toLocaleString()} Bunz)\nReward: ${parsedReward}%\nDueño: ${owner.firstName || '?'} (@${owner.username || '?'})\n\nEstado: ${isGoogleVerified ? '✅ Aprobado (Google)' : '⏳ Pendiente de verificación'}`,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
              }),
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
