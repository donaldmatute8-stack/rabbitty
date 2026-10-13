import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, reservations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { processReferralAndNotifications } from '@/lib/referralLogic';
import { awardHops, evaluateHatTricks } from '@/lib/gamificationLogic';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { telegramId, businessName, offerTitle, bunzCost, initData, idempotencyKey: clientKey } = await req.json();

    if ((!initData && !telegramId) || !businessName || !offerTitle || bunzCost === undefined || typeof bunzCost !== 'number' || bunzCost <= 0) {
      return NextResponse.json({ error: 'Missing required fields or invalid bunzCost' }, { status: 400 });
    }

    // Server-to-server callers authenticate with the shared Bearer secret and may
    // pass telegramId directly. Browser callers must prove identity via Telegram initData.
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    const serverAuthed = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`;

    let resolvedTelegramId: string | null = null;
    if (serverAuthed) {
      resolvedTelegramId = telegramId ? telegramId.toString() : null;
    } else {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!initData) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (botToken && !validateTelegramInitData(initData, botToken)) {
        return NextResponse.json({ error: 'Invalid Telegram authentication' }, { status: 401 });
      }
      const tUser = parseTelegramUser(initData);
      if (!tUser?.id) {
        return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 });
      }
      resolvedTelegramId = tUser.id.toString();
    }

    if (!resolvedTelegramId) {
      return NextResponse.json({ error: 'Could not resolve user identity' }, { status: 401 });
    }

    // Find User
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, resolvedTelegramId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find Business by name (since the mock API returns businessName)
    // In a fully normalized system, it would return businessId, but we will find by name for now.
    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.name, businessName)
    });

    // If business doesn't exist, we just error out. Our seed should have it.
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const idempotencyKey = `res_ord_${clientKey || crypto.randomUUID()}`;

    // Atomic SQL transaction with pessimistic row lock and authoritative Ledger entry
    const reservation = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (!lockedUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const prior = await findLedgerEntry(idempotencyKey, tx);
      if (prior) {
        return null;
      }

      const available = (lockedUser.totalBunzEarned ?? 0) - (lockedUser.totalBunzSpent ?? 0);
      if (available < bunzCost) {
        throw new Error('INSUFFICIENT_BUNZ');
      }

      // Record spending
      await tx
        .update(users)
        .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${bunzCost}` })
        .where(eq(users.id, lockedUser.id));

      // Create reservation
      const [resRow] = await tx
        .insert(reservations)
        .values({
          userId: user.id,
          businessId: business.id,
          title: offerTitle,
          bunzCost: bunzCost,
          status: "PENDING",
        })
        .returning();

      // Record authoritative Ledger entry
      await recordLedgerTransaction(
        {
          branchId: business.id,
          payerSubjectId: user.telegramId || user.id,
          payeeSubjectId: business.id,
          amount: bunzCost,
          type: "SPEND",
          referenceId: resRow.id,
          idempotencyKey,
          metadata: { offerTitle, businessId: business.id },
        },
        tx
      );

      return resRow;
    });

    if (!reservation) {
      return NextResponse.json({ success: true, message: 'Reserva ya procesada.' });
    }

    // Trigger referral and notifications (SPEND event)
    await processReferralAndNotifications(user.id, 'SPEND');

    // Determine if it's a new business for the user
    const previousReservation = await db.query.reservations.findFirst({
      where: and(eq(reservations.userId, user.id), eq(reservations.businessId, business.id))
    });
    const isNewBusiness = !previousReservation;

    // Gamification Engine
    await awardHops(user.id, isNewBusiness);
    await evaluateHatTricks(user.id, { type: 'RESERVATIONS', value: 1, category: business.category });

    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    console.error('Reservation API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');

    if (!ownerId) {
      return NextResponse.json({ error: 'Missing ownerId' }, { status: 400 });
    }

    // Find businesses owned by this user
    const userBusinesses = await db.query.ownedBusinesses.findMany({
      where: eq(ownedBusinesses.ownerId, ownerId)
    });

    if (userBusinesses.length === 0) {
      return NextResponse.json({ success: true, reservations: [] });
    }

    const businessIds = userBusinesses.map(b => b.id);

    // Drizzle doesn't have a simple IN clause via query builder without `inArray`, so we just filter manually or use eq in a loop if few.
    // Let's use standard query
    const res = await db.query.reservations.findMany({
      with: {
        user: true,
        business: true
      }
    });

    const filteredReservations = res.filter(r => businessIds.includes(r.businessId));

    return NextResponse.json({ success: true, reservations: filteredReservations });
  } catch (error) {
    console.error('Reservation API GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
