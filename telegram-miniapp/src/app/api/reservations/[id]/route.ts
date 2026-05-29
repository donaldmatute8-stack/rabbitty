import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, reservations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    const id = params.id;

    if (!['CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, id)
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // If REJECTED or CANCELLED, we must refund the Bunz
    if (status === 'REJECTED' || status === 'CANCELLED') {
      const user = await db.query.users.findFirst({
        where: eq(users.id, reservation.userId)
      });
      if (user) {
        await db.update(users)
          .set({ totalBunzEarned: user.totalBunzEarned + reservation.bunzCost })
          .where(eq(users.id, user.id));
      }
    }

    const [updated] = await db.update(reservations)
      .set({ status })
      .where(eq(reservations.id, id))
      .returning();

    return NextResponse.json({ success: true, reservation: updated });
  } catch (error) {
    console.error('Reservation PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
