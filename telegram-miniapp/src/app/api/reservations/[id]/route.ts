import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, reservations, ownedBusinesses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { status } = await req.json();
    const { id } = await params;

    if (!['CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, id)
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Check authorization: user can only CANCEL their own reservation; business owner can CONFIRM/COMPLETE/REJECT
    const isOwner = reservation.userId === caller.id;
    let isBizOwner = false;
    if (reservation.businessId) {
      const biz = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, reservation.businessId)
      });
      if (biz && biz.ownerId === caller.id) {
        isBizOwner = true;
      }
    }

    if (!isOwner && !isBizOwner && caller.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado para modificar esta reserva' }, { status: 403 });
    }

    const refundRequested = status === 'REJECTED' || status === 'CANCELLED';

    // Atomic: lock the reservation row so concurrent requests cannot double-refund,
    // decrement totalBunzSpent and record an idempotent REFUND ledger entry.
    const updated = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, id))
        .for('update');

      if (!locked) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const alreadyTerminal = locked.status === 'REJECTED' || locked.status === 'CANCELLED';

      if (refundRequested && !alreadyTerminal && locked.bunzCost > 0) {
        const idempotencyKey = `refund_res_${locked.id}`;
        const prior = await findLedgerEntry(idempotencyKey, tx);

        if (!prior) {
          const [lockedUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, locked.userId))
            .for('update');

          if (lockedUser) {
            await tx
              .update(users)
              .set({ totalBunzSpent: sql`GREATEST(COALESCE(${users.totalBunzSpent}, 0) - ${locked.bunzCost}, 0)` })
              .where(eq(users.id, lockedUser.id));

            await recordLedgerTransaction(
              {
                branchId: locked.businessId,
                payerSubjectId: locked.businessId || 'system',
                payeeSubjectId: lockedUser.telegramId || lockedUser.id,
                amount: locked.bunzCost,
                type: 'REFUND',
                referenceId: locked.id,
                idempotencyKey,
                metadata: { reservationId: locked.id, reason: status },
              },
              tx
            );
          }
        }
      }

      const [row] = await tx
        .update(reservations)
        .set({ status })
        .where(eq(reservations.id, id))
        .returning();

      return row;
    });

    return NextResponse.json({ success: true, reservation: updated });
  } catch (error) {
    console.error('Reservation PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
