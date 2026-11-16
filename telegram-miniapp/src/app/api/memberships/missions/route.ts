/**
 * ── Retos de membresía ──────────────────────────────────────────────────────
 * La lógica vive en `lib/membershipMissions.ts` para que Gamificación y
 * Membresías muestren exactamente lo mismo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getMembershipMissions } from '@/lib/membershipMissions';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const memberships = await getMembershipMissions(caller.id);
    return NextResponse.json({ success: true, memberships });
  } catch (err) {
    console.error('[memberships/missions] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
