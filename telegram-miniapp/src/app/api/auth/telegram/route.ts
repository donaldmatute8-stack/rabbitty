import { NextResponse } from 'next/server';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';
import { db } from '@/db';
import { users, referrals } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { initData, startParam } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    // El Bot Token debería estar en variables de entorno en producción
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test_bot_token';
    
    // Validar firma criptográfica (saltamos la validación en desarrollo si no hay token)
    const isValid = process.env.NODE_ENV === 'development' && botToken === 'test_bot_token' 
      ? true 
      : validateTelegramInitData(initData, botToken);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Could not parse user data' }, { status: 400 });
    }

    // Buscar o crear usuario en la BD
    const telegramId = tUser.id.toString();
    
    let user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId)
    });

    if (!user) {
      const [newUser] = await db.insert(users).values({
        telegramId,
        username: tUser.username || null,
        firstName: tUser.first_name || null,
        lastName: tUser.last_name || null,
        totalBunzEarned: 0
      }).returning();
      user = newUser;

      // Handle Referral if present
      if (startParam && startParam.startsWith('ref_')) {
        const inviterTelegramId = startParam.replace('ref_', '');
        
        // Don't refer yourself
        if (inviterTelegramId !== telegramId) {
          const inviter = await db.query.users.findFirst({
            where: eq(users.telegramId, inviterTelegramId)
          });

          if (inviter) {
            await db.insert(referrals).values({
              inviterId: inviter.id,
              invitedId: user.id,
              status: "PENDING",
              rewardAmount: 50
            });
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        tonWalletAddress: user.tonWalletAddress,
        totalBunzEarned: user.totalBunzEarned
      }
    });

  } catch (error) {
    console.error('Telegram Auth API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
