/**
 * ── Retos de membresía (una sola fuente) ────────────────────────────────────
 *
 * Los retos de membresía son **no monetarios**: insignias que se muestran en la
 * app y que el negocio puede honrar en mostrador (upgrade, prioridad). No
 * emiten Bunz, así que no tocan el pozo de lealtad ni Hops.
 *
 * Vive aquí para que la página de Gamificación y la de Membresías muestren
 * exactamente lo mismo (antes había dos superficies de "misiones").
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  entitlementUsages,
  membershipPlanVersions,
  membershipPlans,
  membershipSubscriptions,
  ownedBusinesses,
  transactions,
} from '@/db/schema';

export type MembershipTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface MembershipMission {
  id: string;
  title: string;
  hint: string;
  progress: number;
  target: number;
  unit: string;
  done: boolean;
  badge: { id: string; label: string; color: string };
}

export interface MembershipMissionsBlock {
  subscriptionId: string;
  businessName: string;
  planName: string;
  tier: MembershipTier;
  renewals: number;
  visits: number;
  benefitsUsed: number;
  missions: MembershipMission[];
  badgesEarned: Array<{ id: string; label: string; color: string }>;
}

const monthsOf = (interval?: string | null) =>
  interval === 'QUARTERLY' ? 3 : interval === 'SEMIANNUAL' ? 6 : interval === 'ANNUAL' || interval === 'YEARLY' ? 12 : 1;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getMembershipMissions(userId: string): Promise<MembershipMissionsBlock[]> {
  const subs = await db
    .select({
      id: membershipSubscriptions.id,
      businessId: membershipSubscriptions.businessId,
      createdAt: membershipSubscriptions.createdAt,
      planName: membershipPlans.name,
      billingInterval: membershipPlanVersions.billingInterval,
      businessName: ownedBusinesses.name,
    })
    .from(membershipSubscriptions)
    .leftJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
    .leftJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
    .leftJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipSubscriptions.businessId))
    .where(and(eq(membershipSubscriptions.userId, userId), eq(membershipSubscriptions.status, 'ACTIVE')));

  if (subs.length === 0) return [];

  const now = Date.now();
  const since7 = new Date(now - 7 * 86_400_000);
  const since30 = new Date(now - 30 * 86_400_000);
  const result: MembershipMissionsBlock[] = [];

  for (const sub of subs) {
    const months = monthsOf(sub.billingInterval);
    const renewals = Math.max(
      0,
      Math.floor(((now - new Date(sub.createdAt as unknown as string).getTime()) / (30.44 * 86_400_000)) / months),
    );
    const tier: MembershipTier = renewals >= 5 ? 'GOLD' : renewals >= 2 ? 'SILVER' : 'BRONZE';

    const [usage30] = await db
      .select({ units: sql<number>`COALESCE(SUM(${entitlementUsages.quantityUsed}), 0)::int` })
      .from(entitlementUsages)
      .where(and(eq(entitlementUsages.subscriptionId, sub.id), gte(entitlementUsages.redeemedAt, since30)));
    const benefitsUsed = Number(usage30?.units ?? 0);

    const usageDates = await db
      .select({ at: entitlementUsages.redeemedAt })
      .from(entitlementUsages)
      .where(and(eq(entitlementUsages.subscriptionId, sub.id), gte(entitlementUsages.redeemedAt, since7)));

    const purchaseDates = sub.businessId
      ? await db
          .select({ at: transactions.createdAt })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.businessId, sub.businessId),
              gte(transactions.createdAt, since7),
            ),
          )
      : [];

    const days = new Set<string>();
    for (const row of [...usageDates, ...purchaseDates]) {
      if (row.at) days.add(dayKey(new Date(row.at)));
    }
    const visits = days.size;

    const missions: MembershipMission[] = [
      {
        id: 'VISITS_WEEK',
        title: 'Visita 3 veces esta semana',
        hint: 'Cuenta cualquier consumo en el local',
        progress: Math.min(visits, 3),
        target: 3,
        unit: 'visitas',
        done: visits >= 3,
        badge: { id: 'EXPLORER', label: 'Explorador', color: '#22D3EE' },
      },
      {
        id: 'BENEFITS_MONTH',
        title: 'Usa 2 beneficios este mes',
        hint: 'Canjea tu café, descuento o crédito',
        progress: Math.min(benefitsUsed, 2),
        target: 2,
        unit: 'beneficios',
        done: benefitsUsed >= 2,
        badge: { id: 'REGULAR', label: 'Constante', color: '#A855F7' },
      },
      {
        id: 'RENEWAL',
        title: 'Sostén tu membresía',
        hint: '2 renovaciones seguidas',
        progress: Math.min(renewals, 2),
        target: 2,
        unit: 'renovaciones',
        done: renewals >= 2,
        badge: { id: 'VETERAN', label: 'Veterano', color: '#FFD166' },
      },
    ];

    result.push({
      subscriptionId: sub.id,
      businessName: sub.businessName ?? 'Comercio',
      planName: sub.planName ?? 'Membresía',
      tier,
      renewals,
      visits,
      benefitsUsed,
      missions,
      badgesEarned: missions.filter((m) => m.done).map((m) => m.badge),
    });
  }

  return result;
}
