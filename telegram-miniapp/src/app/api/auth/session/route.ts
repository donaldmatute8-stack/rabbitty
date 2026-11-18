import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, referrals, presenceSessions } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

// El saldo de Bunz se lee de aquí: nunca debe servirse desde caché, o el
// comensal sigue viendo su saldo anterior aunque ya se le haya acreditado.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Una sola implementación de autenticación (token de sesión, Telegram o el
    // bypass de desarrollo, que el servidor ignora en producción).
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 401 });
    }

    // Fetch canonical user profile
    const profile = await db.query.users.findFirst({
      where: eq(users.id, caller.id),
      with: { level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Pending referral bunz
    let pendingBunz = 0;
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
    }).from(referrals)
      .where(and(eq(referrals.inviterId, profile.id), eq(referrals.status, 'PENDING')));
    pendingBunz = result[0]?.total ?? 0;

    // H18: 'negocios visitados' = DISTINCT negocios con presencia real (no el
    // contador acumulado de check-ins que cuenta días repetidos)
    const distinctBizRows = await db
      .select({ businessId: presenceSessions.businessId })
      .from(presenceSessions)
      .where(eq(presenceSessions.userId, profile.id))
      .groupBy(presenceSessions.businessId);
    const distinctBusinesses = distinctBizRows.length;

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        pendingBunz,
        distinctBusinesses,
      },
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('[AUTH SESSION ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
