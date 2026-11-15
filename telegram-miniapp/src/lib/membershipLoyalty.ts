/**
 * ── Bono de lealtad de membresía (Fase 15.2.2) ──────────────────────────────
 *
 * Regla económica (la importante): **no se emite un solo Bunz sin respaldo**.
 *
 * El bono NO multiplica la emisión general ni crea moneda: se paga de un
 * **pozo mensual** equivalente al 10 % del neto que el afiliado ya cobró por
 * esa membresía (precio − 8 % de comisión de plataforma). Si el pozo se agota,
 * se deja de bonificar hasta el siguiente mes. Si el socio no compra, no se
 * emite nada: el pozo es un techo autorizado, no una emisión.
 *
 * Niveles por antigüedad (periodos completos pagados):
 *   Bronce  0-1 renovaciones → 0 %   (sin bono: aún no hay historial)
 *   Plata   2-4             → +10 % sobre el cashback de esa compra
 *   Oro     5+              → +20 %
 *
 * Topes duros:
 *   · solo membresías PAGADAS (fuera cortesías, invitaciones y promociones)
 *   · nunca sobre consumos cubiertos por la membresía (esos no emiten Bunz)
 *   · no acumulable con campañas flash (si hay boost, gana el boost)
 *   · máximo por ticket (LOYALTY_MAX_PER_ORDER, 15 Bunz)
 *   · apagable con LOYALTY_MULTIPLIER=off sin deploy
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { ledgerEntries, membershipPlanVersions, membershipSubscriptions } from '@/db/schema';

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD';

/** Comisión de plataforma (la misma del checkout de membresías). */
const PLATFORM_FEE = 0.08;
/** % del neto mensual de la membresía destinado al pozo de bono. */
const POOL_PCT = Number(process.env.LOYALTY_POOL_PCT ?? 10) / 100;
/** Tope de bono por ticket. */
const MAX_PER_ORDER = Number(process.env.LOYALTY_MAX_PER_ORDER ?? 15);
/** Multiplicador sobre el cashback base, por nivel. */
const TIER_PCT: Record<LoyaltyTier, number> = { BRONZE: 0, SILVER: 0.1, GOLD: 0.2 };

export interface LoyaltyBonus {
  bonus: number;
  tier: LoyaltyTier;
  renewals: number;
  /** Pozo autorizado del mes (Bunz). */
  pool: number;
  spent: number;
  remaining: number;
  subscriptionId: string;
}

const isEnabled = () => (process.env.LOYALTY_MULTIPLIER ?? 'on') !== 'off';

const monthsOf = (interval?: string | null) =>
  interval === 'QUARTERLY' ? 3 : interval === 'SEMIANNUAL' ? 6 : interval === 'ANNUAL' || interval === 'YEARLY' ? 12 : 1;

/**
 * Calcula el bono de lealtad aplicable a esta compra, o `null` si no
 * corresponde. Nunca lanza: un fallo aquí no debe romper un cobro.
 */
export async function resolveLoyaltyBonus(params: {
  userId: string;
  businessId: string;
  /** Bunz que ya genera la compra por la tasa del negocio. */
  baseBunz: number;
}): Promise<LoyaltyBonus | null> {
  if (!isEnabled() || params.baseBunz <= 0) return null;

  try {
    const [row] = await db
      .select({ sub: membershipSubscriptions, version: membershipPlanVersions })
      .from(membershipSubscriptions)
      .leftJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
      .where(
        and(
          eq(membershipSubscriptions.userId, params.userId),
          eq(membershipSubscriptions.businessId, params.businessId),
          eq(membershipSubscriptions.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!row) return null;

    // Solo membresías pagadas. Cortesías, invitaciones y promociones no
    // financian un pozo, así que no bonifican.
    const origin = row.sub.membershipOrigin ?? 'PURCHASED';
    if (origin !== 'PURCHASED') return null;
    if (!row.sub.paymentProvider || row.sub.paymentProvider === 'PROMO') return null;

    const price = Number(row.version?.priceFiat ?? 0);
    if (!(price > 0)) return null;

    const months = monthsOf(row.version?.billingInterval);
    const monthlyNet = (price * (1 - PLATFORM_FEE)) / months;
    const pool = Math.floor(monthlyNet * POOL_PCT);
    if (pool <= 0) return null;

    // Renovaciones = periodos completos pagados desde el alta.
    const elapsedMonths =
      (Date.now() - new Date(row.sub.createdAt as unknown as string).getTime()) / (30.44 * 86_400_000);
    const renewals = Math.max(0, Math.floor(elapsedMonths / months));
    const tier: LoyaltyTier = renewals >= 5 ? 'GOLD' : renewals >= 2 ? 'SILVER' : 'BRONZE';

    const pct = TIER_PCT[tier];
    if (pct <= 0) return null;

    // Consumo del pozo en los últimos 30 días (ventana móvil: simple y estable).
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [spentRow] = await db
      .select({
        spent: sql<number>`COALESCE(SUM((${ledgerEntries.metadata}->>'loyaltyBonus')::numeric), 0)`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.payeeSubjectId, `usr_${params.userId}`),
          sql`${ledgerEntries.metadata}->>'subscriptionId' = ${row.sub.id}`,
          gte(ledgerEntries.createdAt, since),
        ),
      );

    const spent = Number(spentRow?.spent ?? 0);
    const remaining = Math.max(0, pool - spent);
    if (remaining <= 0) return null;

    const raw = Math.floor(params.baseBunz * pct);
    const bonus = Math.min(raw, remaining, MAX_PER_ORDER);
    if (bonus <= 0) return null;

    return { bonus, tier, renewals, pool, spent, remaining, subscriptionId: row.sub.id };
  } catch (err) {
    console.warn('[loyalty] no se pudo calcular el bono:', err);
    return null;
  }
}
