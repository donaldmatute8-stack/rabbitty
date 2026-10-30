import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { reconciliationRequests, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/** Conciliaciones del rabbitter autenticado (seguimiento). */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const rows = await db
      .select({
        id: reconciliationRequests.id,
        orderId: reconciliationRequests.orderId,
        businessName: ownedBusinesses.name,
        claimedBunz: reconciliationRequests.claimedBunz,
        status: reconciliationRequests.status,
        affiliateNote: reconciliationRequests.affiliateNote,
        godNote: reconciliationRequests.godNote,
        createdAt: reconciliationRequests.createdAt,
      })
      .from(reconciliationRequests)
      .leftJoin(ownedBusinesses, eq(ownedBusinesses.id, reconciliationRequests.businessId))
      .where(eq(reconciliationRequests.userId, caller.id))
      .orderBy(desc(reconciliationRequests.createdAt))
      .limit(50);

    return NextResponse.json({ success: true, requests: rows });
  } catch (error) {
    console.error('[RECONCILIATION LIST ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
