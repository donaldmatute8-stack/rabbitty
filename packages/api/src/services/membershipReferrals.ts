/**
 * ── Referidos de membresías ──────────────────────────────────────────────────
 *
 * El tenant elige UNA recompensa de un catálogo cerrado. Nosotros definimos las
 * opciones y los topes; el negocio decide cuánto dar.
 *
 * Economía (importante):
 *  · Bunz **no se mintean** para un referido. Se pagan con la bóveda del comercio
 *    (`ownedBusinesses.bunzBalance`), igual que un regalo de comportamiento.
 *  · Cada Bunz entregado queda como asiento EARN canónico `biz_<tenant>` →
 *    `usr_<referrer>` (ADR-008), idempotente por `ref_<businessId>_<referredId>`.
 *  · Un Bunz emitido sin venta es un pasivo del negocio (capacidad de canje), por
 *    eso se topa por mes y por total, y si la bóveda no alcanza queda PENDING.
 *
 * Mintear solo tiene sentido cuando entra dinero (venta): ahí `transactions.bunzMinted`
 * respalda la emisión. Un referido no cobra, así que no se mintea.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import {
  membershipReferralPrograms,
  membershipReferralRewards,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core/schema";
import { ledgerEntries } from "@rabbitty/database-restaurant/schema";
import { biz, usr } from "./ledgerSubjects";

export type ReferralRewardType = "NONE" | "BUNZ" | "DISCOUNT_PCT" | "EXTRA_TRIAL_DAYS";

/** Montos de Bunz que el tenant puede elegir. Fijos a propósito. */
export const REFERRAL_BUNZ_OPTIONS = [50, 100, 200, 300, 500, 1000] as const;

export interface ReferralRewardOption {
  type: ReferralRewardType;
  label: string;
  description: string;
  /** false = aparece en el selector pero deshabilitado ("pronto"). */
  available: boolean;
  recommended?: boolean;
  values?: readonly number[];
  valueLabel?: string;
}

/**
 * Catálogo cerrado. Solo BUNZ liquida automáticamente hoy; descuento y días
 * extra se muestran como "pronto" para no prometer algo que no se entrega.
 */
export const REFERRAL_REWARD_CATALOG: ReferralRewardOption[] = [
  {
    type: "BUNZ",
    label: "Bunz",
    description: "Se abonan a la billetera del Rabbitter que invitó, desde la bóveda del negocio.",
    available: true,
    recommended: true,
    values: REFERRAL_BUNZ_OPTIONS,
    valueLabel: "Bunz por referido",
  },
  {
    type: "DISCOUNT_PCT",
    label: "Descuento en su próxima membresía",
    description: "Porcentaje de descuento para el que invita, aplicado en su siguiente renovación.",
    available: false,
    values: [5, 10, 15, 20],
    valueLabel: "% de descuento",
  },
  {
    type: "EXTRA_TRIAL_DAYS",
    label: "Días extra de membresía",
    description: "Extiende la membresía del que invita sin costo.",
    available: false,
    values: [7, 14, 30],
    valueLabel: "Días extra",
  },
  {
    type: "NONE",
    label: "Sin recompensa",
    description: "Solo se registra la atribución, sin premio.",
    available: true,
  },
];

export const DEFAULT_REFERRAL_PROGRAM = {
  isActive: false,
  rewardType: "BUNZ" as ReferralRewardType,
  bunzAmount: 100,
  discountPct: 10,
  extraTrialDays: 14,
  triggerEvent: "FIRST_ACTIVATION" as const,
  maxRewardsMonthly: 5,
  maxRewardsTotal: 100,
  minReferredAccountAgeHours: 0,
  notes: null as string | null,
};

export interface ReferralProgramView {
  businessId: string;
  isActive: boolean;
  rewardType: ReferralRewardType;
  bunzAmount: number;
  discountPct: number;
  extraTrialDays: number;
  triggerEvent: string;
  maxRewardsMonthly: number;
  maxRewardsTotal: number;
  minReferredAccountAgeHours: number;
  notes: string | null;
  exists: boolean;
  /** Bunz disponibles en la bóveda del negocio (para el selector del admin). */
  vaultBalance?: number;
}

export async function getReferralProgram(db: any, businessId: string): Promise<ReferralProgramView> {
  const [row] = await db
    .select()
    .from(membershipReferralPrograms)
    .where(eq(membershipReferralPrograms.businessId, businessId))
    .limit(1);

  const [bizRow] = await db
    .select({ bunzBalance: ownedBusinesses.bunzBalance })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.id, businessId))
    .limit(1);

  const base = row ?? DEFAULT_REFERRAL_PROGRAM;
  return {
    businessId,
    isActive: Boolean(base.isActive),
    rewardType: (base.rewardType as ReferralRewardType) ?? "BUNZ",
    bunzAmount: Number(base.bunzAmount ?? 100),
    discountPct: Number(base.discountPct ?? 10),
    extraTrialDays: Number(base.extraTrialDays ?? 14),
    triggerEvent: base.triggerEvent ?? "FIRST_ACTIVATION",
    maxRewardsMonthly: Number(base.maxRewardsMonthly ?? 5),
    maxRewardsTotal: Number(base.maxRewardsTotal ?? 100),
    minReferredAccountAgeHours: Number(base.minReferredAccountAgeHours ?? 0),
    notes: base.notes ?? null,
    exists: Boolean(row),
    vaultBalance: Number(bizRow?.bunzBalance ?? 0),
  };
}

export type ReferralGrantOutcome =
  | { status: "GRANTED"; rewardId: string; value: number; rewardType: ReferralRewardType }
  | { status: "PENDING"; rewardId: string; value: number; reason: string }
  | { status: "SKIPPED"; reason: string };

interface GrantArgs {
  db: any;
  businessId: string;
  referrerUserId: string | null | undefined;
  referredUserId: string;
  subscriptionId?: string | null;
  planId?: string | null;
}

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

/**
 * Otorga la recompensa del programa si el referido cumple. Nunca lanza: el alta de
 * la membresía no debe fallar porque el premio no se pudo pagar.
 */
export async function grantReferralReward(args: GrantArgs): Promise<ReferralGrantOutcome> {
  const { db, businessId, referredUserId, subscriptionId, planId } = args;
  const referrerUserId = args.referrerUserId ? String(args.referrerUserId) : "";

  try {
    if (!referrerUserId || referrerUserId === referredUserId) {
      return { status: "SKIPPED", reason: "SELF_REFERRAL" };
    }

    const program = await getReferralProgram(db, businessId);
    if (!program.isActive || program.rewardType === "NONE") {
      return { status: "SKIPPED", reason: "NO_PROGRAM" };
    }
    if (program.rewardType !== "BUNZ") {
      return { status: "SKIPPED", reason: "REWARD_NOT_AVAILABLE" };
    }

    // Anti-abuso: antigüedad mínima de la cuenta referida.
    if (program.minReferredAccountAgeHours > 0) {
      const [ref] = await db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, referredUserId))
        .limit(1);
      const ageHours = ref?.createdAt
        ? (Date.now() - new Date(ref.createdAt).getTime()) / 3_600_000
        : 0;
      if (ageHours < program.minReferredAccountAgeHours) {
        return { status: "SKIPPED", reason: "REFERRED_TOO_NEW" };
      }
    }

    // Un premio por referido y negocio, de por vida.
    const [already] = await db
      .select({ id: membershipReferralRewards.id })
      .from(membershipReferralRewards)
      .where(
        and(
          eq(membershipReferralRewards.businessId, businessId),
          eq(membershipReferralRewards.referredUserId, referredUserId),
        ),
      )
      .limit(1);
    if (already) return { status: "SKIPPED", reason: "ALREADY_REWARDED" };

    const [monthlyRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(membershipReferralRewards)
      .where(
        and(
          eq(membershipReferralRewards.businessId, businessId),
          eq(membershipReferralRewards.referrerUserId, referrerUserId),
          eq(membershipReferralRewards.status, "GRANTED"),
          gte(membershipReferralRewards.createdAt, monthStart()),
        ),
      );
    if (Number(monthlyRow?.count ?? 0) >= program.maxRewardsMonthly) {
      return { status: "SKIPPED", reason: "MONTHLY_CAP" };
    }

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(membershipReferralRewards)
      .where(
        and(
          eq(membershipReferralRewards.businessId, businessId),
          eq(membershipReferralRewards.status, "GRANTED"),
        ),
      );
    if (Number(totalRow?.count ?? 0) >= program.maxRewardsTotal) {
      return { status: "SKIPPED", reason: "PROGRAM_CAP" };
    }

    const amount = Math.max(0, Math.floor(program.bunzAmount));
    if (amount <= 0) return { status: "SKIPPED", reason: "INVALID_AMOUNT" };

    const ledgerKey = `ref_${businessId}_${referredUserId}`;

    return await db.transaction(async (tx: any) => {
      // Bóveda del comercio: el premio se paga con inventario real, no se mintea.
      const [debited] = await tx
        .update(ownedBusinesses)
        .set({ bunzBalance: sql`GREATEST(0, COALESCE("bunzBalance", 0) - ${amount})` })
        .where(
          and(
            eq(ownedBusinesses.id, businessId),
            sql`COALESCE("bunzBalance", 0) >= ${amount}`,
          ),
        )
        .returning({ bunzBalance: ownedBusinesses.bunzBalance });

      if (!debited) {
        const [pending] = await tx
          .insert(membershipReferralRewards)
          .values({
            businessId,
            referrerUserId,
            referredUserId,
            subscriptionId: subscriptionId ?? null,
            planId: planId ?? null,
            rewardType: "BUNZ",
            value: amount,
            status: "PENDING",
            reason: "VAULT_INSUFFICIENT",
            ledgerKey,
            grantedAt: null,
          })
          .onConflictDoNothing()
          .returning({ id: membershipReferralRewards.id });
        return {
          status: "PENDING" as const,
          rewardId: pending?.id ?? "",
          value: amount,
          reason: "VAULT_INSUFFICIENT",
        };
      }

      await tx
        .update(users)
        .set({
          totalBunzEarned: sql`COALESCE("totalBunzEarned", 0) + ${amount}`,
          hasEarnedFirstBunz: true,
        })
        .where(eq(users.id, referrerUserId));

      const [bizRow] = await tx
        .select({ sandbox: ownedBusinesses.sandbox })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, businessId))
        .limit(1);
      const [userRow] = await tx
        .select({ sandbox: users.sandbox })
        .from(users)
        .where(eq(users.id, referrerUserId))
        .limit(1);

      await tx
        .insert(ledgerEntries)
        .values({
          payerSubjectId: biz(businessId),
          payeeSubjectId: usr(referrerUserId),
          amount,
          currency: "BUNZ",
          sandbox: Boolean(bizRow?.sandbox || userRow?.sandbox),
          type: "EARN",
          referenceId: referralReference(referredUserId),
          idempotencyKey: ledgerKey,
          metadata: {
            kind: "MEMBERSHIP_REFERRAL",
            businessId,
            referrerUserId,
            referredUserId,
            subscriptionId: subscriptionId ?? null,
            planId: planId ?? null,
          },
        })
        .onConflictDoNothing({ target: ledgerEntries.idempotencyKey });

      const [reward] = await tx
        .insert(membershipReferralRewards)
        .values({
          businessId,
          referrerUserId,
          referredUserId,
          subscriptionId: subscriptionId ?? null,
          planId: planId ?? null,
          rewardType: "BUNZ",
          value: amount,
          status: "GRANTED",
          ledgerKey,
          grantedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: membershipReferralRewards.id });

      return {
        status: "GRANTED" as const,
        rewardId: reward?.id ?? "",
        value: amount,
        rewardType: "BUNZ" as const,
      };
    });
  } catch (error) {
    console.error("[MEMBERSHIP_REFERRAL] grant falló:", error);
    return { status: "SKIPPED", reason: "ERROR" };
  }
}

/** Referencia corta y estable para el asiento (sin exponer el id del referido). */
function referralReference(referredUserId: string): string {
  return `referral:${referredUserId.slice(0, 8)}`;
}

/** Resumen para el Rabbitter: su programa de referidos y lo que ya ganó. */
export async function getReferrerSummary(db: any, businessId: string, userId: string) {
  const program = await getReferralProgram(db, businessId);
  const [agg] = await db
    .select({
      granted: sql<number>`count(*) FILTER (WHERE status = 'GRANTED')::int`,
      pending: sql<number>`count(*) FILTER (WHERE status = 'PENDING')::int`,
      bunz: sql<number>`COALESCE(sum(value) FILTER (WHERE status = 'GRANTED'), 0)::int`,
    })
    .from(membershipReferralRewards)
    .where(
      and(
        eq(membershipReferralRewards.businessId, businessId),
        eq(membershipReferralRewards.referrerUserId, userId),
      ),
    );

  return {
    isActive: program.isActive,
    rewardType: program.rewardType,
    bunzAmount: program.bunzAmount,
    discountPct: program.discountPct,
    extraTrialDays: program.extraTrialDays,
    granted: Number(agg?.granted ?? 0),
    pending: Number(agg?.pending ?? 0),
    bunzEarned: Number(agg?.bunz ?? 0),
  };
}
