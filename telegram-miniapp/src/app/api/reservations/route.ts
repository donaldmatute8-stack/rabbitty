import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, reservations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { processReferralAndNotifications } from '@/lib/referralLogic';
import { awardHops, evaluateHatTricks } from '@/lib/gamificationLogic';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';

export async function POST(req: Request) {
  try {
    const { telegramId, businessName, offerTitle, bunzCost } = await req.json();

    if (!telegramId || !businessName || !offerTitle || bunzCost === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find User
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId)
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find Business by name (since the mock API returns businessName)
    // In a fully normalized system, it would return businessId, but we will find by name for now.
    let business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.name, businessName)
    });

    // If business doesn't exist, we just error out. Our seed should have it.
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

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
      const idempotencyKey = `res_ord_${resRow.id}_${Date.now()}`;
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
