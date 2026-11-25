import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  branches,
  rabbitChairActivations,
  rabbitChairGrants,
  rabbitChairGrantUses,
  rabbitChairSlots,
  restaurants,
} from "@rabbitty/database-restaurant/schema";
import type { getRestaurantDb } from "../db";

/**
 * ── Rabbit Chair · La Silla (Fase 0/1) ──────────────────────────────────────
 *
 * Núcleo sin dinero real: activación, cupo, hold atómico, créditos del tenant,
 * cronómetro y cierre. El cobro real (Stripe/terminal) y la orden entran en
 * fase 2; aquí el checkout es explícitamente sandbox.
 *
 * Decisiones (ADR-016):
 *  · El grant y la activación viven en la misma base: consumir crédito y crear
 *    la activación es una sola transacción.
 *  · `PREPAID` cobra en la app al tomar el lugar; `POSTPAID` cobra al final en
 *    POS (aporte abierto).
 *  · Una sola activación LIVE por sucursal (índice único parcial).
 *  · El hold es de 5 minutos y se libera de forma perezosa, sin cron.
 */

export type Db = ReturnType<typeof getRestaurantDb>;

export const RABBIT_CHAIR_FORMATS = ["SINGLE", "BLOCK", "WAVES", "COUPLES"] as const;
export const RABBIT_CHAIR_CHARGE_MODES = ["PREPAID", "POSTPAID"] as const;
export const RABBIT_CHAIR_MENU_MODES = ["COFFEE", "ALCOHOL", "BOTH"] as const;

export type RabbitChairFormat = (typeof RABBIT_CHAIR_FORMATS)[number];
export type RabbitChairChargeMode = (typeof RABBIT_CHAIR_CHARGE_MODES)[number];
export type RabbitChairMenuMode = (typeof RABBIT_CHAIR_MENU_MODES)[number];

export type RabbitChairErrorCode =
  | "BRANCH_NOT_FOUND"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "NO_CREDITS"
  | "SOLD_OUT"
  | "PAYMENT_REQUIRED"
  | "AMOUNT_TOO_LOW"
  | "PAYMENT_CONFLICT"
  | "ALREADY_CLAIMED"
  | "FORBIDDEN";

export class RabbitChairError extends Error {
  constructor(
    readonly code: RabbitChairErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "RabbitChairError";
  }
}

export type CreateGrantInput = {
  businessId: string;
  credits: number;
  days?: number;
  requestId?: string | null;
  createdBy?: string | null;
};

export type CreateActivationInput = {
  branchId: string;
  name?: string;
  format?: RabbitChairFormat;
  capacity?: number;
  partySize?: number;
  waveMinutes?: number | null;
  chargeMode?: RabbitChairChargeMode;
  minContributionCents?: number;
  durationMinutes?: number;
  menuMode?: RabbitChairMenuMode;
  requiresAgeCheck?: boolean;
  playlist?: string | null;
  lightPreset?: string | null;
  bartenderMode?: "FIXED" | "ROTATING";
  randomWindowFrom?: Date | null;
  randomWindowTo?: Date | null;
  radiusMeters?: number | null;
  createdBy?: string | null;
};

function check(condition: unknown, code: RabbitChairErrorCode, message: string): asserts condition {
  if (!condition) {
    throw new RabbitChairError(code, message);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // Drizzle envuelve el error de postgres-js en `cause`.
  const direct = (error as { code?: string }).code;
  const cause = (error as { cause?: { code?: string } }).cause?.code;

  return direct === "23505" || cause === "23505";
}

export async function resolveBusinessId(db: Db, branchId: string): Promise<string> {
  const [row] = await db
    .select({ businessId: restaurants.businessId })
    .from(branches)
    .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
    .where(eq(branches.id, branchId))
    .limit(1);

  if (!row) {
    throw new RabbitChairError("BRANCH_NOT_FOUND", "Sucursal no encontrada", 404);
  }

  return row.businessId;
}

export async function createGrant(db: Db, input: CreateGrantInput) {
  check(input.credits >= 1 && input.credits <= 1000, "INVALID_STATE", "Créditos fuera de rango");
  const days = Math.min(365, Math.max(1, input.days ?? 30));

  if (input.requestId) {
    const [existing] = await db
      .select()
      .from(rabbitChairGrants)
      .where(eq(rabbitChairGrants.requestId, input.requestId))
      .limit(1);
    if (existing) return existing;
  }

  const [grant] = await db
    .insert(rabbitChairGrants)
    .values({
      businessId: input.businessId,
      requestId: input.requestId ?? null,
      creditsTotal: input.credits,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return grant!;
}

/** Resumen para la UI admin (no expone tokens ni datos de otros negocios). */
export async function grantSummary(db: Db, businessId: string) {
  const grants = await db
    .select()
    .from(rabbitChairGrants)
    .where(eq(rabbitChairGrants.businessId, businessId))
    .orderBy(desc(rabbitChairGrants.createdAt));

  const active = grants.filter(
    (grant) =>
      !grant.revokedAt &&
      (!grant.expiresAt || grant.expiresAt.getTime() > Date.now()) &&
      grant.creditsUsed < grant.creditsTotal,
  );

  return {
    active: active.length > 0,
    creditsRemaining: active.reduce(
      (total, grant) => total + (grant.creditsTotal - grant.creditsUsed),
      0,
    ),
    grants,
  };
}

export async function createActivation(db: Db, input: CreateActivationInput) {
  const format = input.format ?? "BLOCK";
  check(RABBIT_CHAIR_FORMATS.includes(format), "INVALID_STATE", "Formato inválido");

  const capacity = Math.min(50, Math.max(1, input.capacity ?? (format === "SINGLE" ? 1 : 10)));
  check(
    format !== "SINGLE" || capacity === 1,
    "INVALID_STATE",
    "El formato SINGLE exige cupo 1",
  );

  const partySize = format === "COUPLES" ? 2 : Math.min(4, Math.max(1, input.partySize ?? 1));
  check(
    format !== "COUPLES" || partySize === 2,
    "INVALID_STATE",
    "El formato COUPLES exige parejas",
  );

  const chargeMode = input.chargeMode ?? "PREPAID";
  check(
    RABBIT_CHAIR_CHARGE_MODES.includes(chargeMode),
    "INVALID_STATE",
    "Modo de cobro inválido",
  );

  const menuMode = input.menuMode ?? "BOTH";
  check(RABBIT_CHAIR_MENU_MODES.includes(menuMode), "INVALID_STATE", "Carta inválida");

  const minContributionCents = Math.round(input.minContributionCents ?? 5000);
  check(
    minContributionCents >= 5000,
    "AMOUNT_TOO_LOW",
    "La aportación mínima es de $50",
  );

  const durationMinutes = Math.min(60, Math.max(1, input.durationMinutes ?? 10));
  const businessId = await resolveBusinessId(db, input.branchId);

  // Ley seca no: si hay alcohol, la experiencia exige verificación de edad.
  const requiresAgeCheck = menuMode === "COFFEE" ? Boolean(input.requiresAgeCheck) : true;

  return db.transaction(async (tx: any) => {
    const [grant] = await tx
      .select()
      .from(rabbitChairGrants)
      .where(
        and(
          eq(rabbitChairGrants.businessId, businessId),
          isNull(rabbitChairGrants.revokedAt),
          sql`${rabbitChairGrants.creditsUsed} < ${rabbitChairGrants.creditsTotal}`,
          or(
            isNull(rabbitChairGrants.expiresAt),
            sql`${rabbitChairGrants.expiresAt} > now()`,
          ),
        ),
      )
      .orderBy(
        asc(sql`${rabbitChairGrants.expiresAt} IS NULL`),
        asc(rabbitChairGrants.expiresAt),
        asc(rabbitChairGrants.createdAt),
      )
      .for("update")
      .limit(1);

    if (!grant) {
      throw new RabbitChairError(
        "NO_CREDITS",
        "El negocio no tiene activaciones disponibles. Pide acceso a Rabbitty.",
        402,
      );
    }

    const activationId = randomUUID();

    await tx.insert(rabbitChairGrantUses).values({
      grantId: grant.id,
      activationId,
      businessId,
    });

    await tx
      .update(rabbitChairGrants)
      .set({
        creditsUsed: sql`${rabbitChairGrants.creditsUsed} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(rabbitChairGrants.id, grant.id));

    const [activation] = await tx
      .insert(rabbitChairActivations)
      .values({
        id: activationId,
        businessId,
        branchId: input.branchId,
        name: input.name?.trim() || "La Silla",
        status: "DRAFT",
        grantId: grant.id,
        format,
        capacity,
        partySize,
        waveMinutes: input.waveMinutes ?? null,
        chargeMode,
        minContributionCents,
        currency: "MXN",
        cardOnly: true,
        durationMinutes,
        requiresAgeCheck,
        menuMode,
        startsAt: null,
        revealAt: null,
        randomWindowFrom: input.randomWindowFrom ?? null,
        randomWindowTo: input.randomWindowTo ?? null,
        radiusMeters: input.radiusMeters ?? null,
        playlist: input.playlist ?? null,
        lightPreset: input.lightPreset ?? null,
        bartenderMode: input.bartenderMode ?? "ROTATING",
        createdBy: input.createdBy ?? null,
      })
      .returning();

    return activation!;
  });
}

export async function listActivations(db: Db, branchId: string) {
  return db
    .select()
    .from(rabbitChairActivations)
    .where(eq(rabbitChairActivations.branchId, branchId))
    .orderBy(desc(rabbitChairActivations.createdAt))
    .limit(50);
}

export async function getActivation(db: Db, activationId: string) {
  const [activation] = await db
    .select()
    .from(rabbitChairActivations)
    .where(eq(rabbitChairActivations.id, activationId))
    .limit(1);

  if (!activation) {
    throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
  }

  return activation;
}

export async function getActiveActivation(db: Db, branchId: string) {
  const [activation] = await db
    .select()
    .from(rabbitChairActivations)
    .where(
      and(
        eq(rabbitChairActivations.branchId, branchId),
        eq(rabbitChairActivations.status, "LIVE"),
      ),
    )
    .limit(1);

  return activation ?? null;
}

async function expireStale(tx: any, activationId: string) {
  await tx
    .update(rabbitChairSlots)
    .set({
      status: "FREE",
      userId: null,
      guestName: null,
      heldUntil: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(rabbitChairSlots.activationId, activationId),
        eq(rabbitChairSlots.status, "HELD"),
        sql`${rabbitChairSlots.heldUntil} < now()`,
      ),
    );

  await tx
    .update(rabbitChairSlots)
    .set({ status: "DONE", updatedAt: sql`now()` })
    .where(
      and(
        eq(rabbitChairSlots.activationId, activationId),
        eq(rabbitChairSlots.status, "SERVED"),
        sql`${rabbitChairSlots.endsAt} < now()`,
      ),
    );
}

export async function openActivation(db: Db, activationId: string) {
  try {
    return await db.transaction(async (tx: any) => {
      const [activation] = await tx
        .select()
        .from(rabbitChairActivations)
        .where(eq(rabbitChairActivations.id, activationId))
        .for("update")
        .limit(1);

      if (!activation) {
        throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
      }

      if (activation.status !== "DRAFT") {
        throw new RabbitChairError(
          "INVALID_STATE",
          `La activación está en ${activation.status} y no se puede abrir`,
          409,
        );
      }

      const [live] = await tx
        .select({ id: rabbitChairActivations.id })
        .from(rabbitChairActivations)
        .where(
          and(
            eq(rabbitChairActivations.branchId, activation.branchId),
            eq(rabbitChairActivations.status, "LIVE"),
            sql`${rabbitChairActivations.id} <> ${activationId}`,
          ),
        )
        .limit(1);

      if (live) {
        throw new RabbitChairError(
          "INVALID_STATE",
          "Ya hay una activación LIVE en esta sucursal",
          409,
        );
      }

      const existing = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(rabbitChairSlots)
        .where(eq(rabbitChairSlots.activationId, activationId));

      if ((existing[0]?.count ?? 0) === 0) {
        const slots = Array.from({ length: activation.capacity }, (_, index) => ({
          activationId,
          index: index + 1,
          wave: 1,
          status: "FREE" as const,
          paymentStatus: "UNPAID" as const,
        }));

        await tx.insert(rabbitChairSlots).values(slots);
      }

      const [updated] = await tx
        .update(rabbitChairActivations)
        .set({
          status: "LIVE",
          startsAt: sql`COALESCE(${rabbitChairActivations.startsAt}, now())`,
          revealAt: sql`COALESCE(${rabbitChairActivations.revealAt}, now())`,
          updatedAt: sql`now()`,
        })
        .where(eq(rabbitChairActivations.id, activationId))
        .returning();

      return updated!;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RabbitChairError(
        "INVALID_STATE",
        "Ya hay una activación LIVE en esta sucursal",
        409,
      );
    }
    throw error;
  }
}

export async function listSlots(db: Db, activationId: string) {
  await db.transaction(async (tx: any) => {
    await expireStale(tx, activationId);
  });

  return db
    .select()
    .from(rabbitChairSlots)
    .where(eq(rabbitChairSlots.activationId, activationId))
    .orderBy(asc(rabbitChairSlots.wave), asc(rabbitChairSlots.index));
}

export type ClaimInput = {
  userId?: string | null;
  guestName?: string | null;
};

/**
 * Toma un lugar con un hold de 5 minutos. El `UPDATE … WHERE id = (SELECT …
 * FOR UPDATE SKIP LOCKED)` es lo que impide la sobreventa: dos pagos
 * simultáneos no pueden llevarse el mismo lugar.
 */
export async function claimSlot(db: Db, activationId: string, input: ClaimInput) {
  try {
    return await db.transaction(async (tx: any) => {
      const [activation] = await tx
        .select()
        .from(rabbitChairActivations)
        .where(eq(rabbitChairActivations.id, activationId))
        .limit(1);

      if (!activation) {
        throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
      }

      if (activation.status !== "LIVE") {
        throw new RabbitChairError(
          activation.status === "SOLD_OUT" ? "SOLD_OUT" : "INVALID_STATE",
          activation.status === "SOLD_OUT"
            ? "La silla está agotada"
            : "La activación no está abierta",
          409,
        );
      }

      await expireStale(tx, activationId);

      // Un Rabbiter no puede acaparar varios lugares de la misma activación.
      // La casa sí puede apartar para invitados (userId null).
      if (input.userId) {
        const [existing] = await tx
          .select({ id: rabbitChairSlots.id })
          .from(rabbitChairSlots)
          .where(
            and(
              eq(rabbitChairSlots.activationId, activationId),
              eq(rabbitChairSlots.userId, input.userId),
              inArray(rabbitChairSlots.status, ["HELD", "PAID", "SEATED"]),
            ),
          )
          .limit(1);

        if (existing) {
          throw new RabbitChairError(
            "ALREADY_CLAIMED",
            "Ya tienes un lugar en esta activación",
            409,
          );
        }
      }

      const [claimed] = await tx
        .update(rabbitChairSlots)
        .set({
          status: "HELD",
          userId: input.userId ?? null,
          guestName: input.guestName?.trim() || null,
          heldUntil: sql`now() + interval '5 minutes'`,
          updatedAt: sql`now()`,
        })
        .where(
          sql`${rabbitChairSlots.id} = (
            SELECT "id" FROM "rabbitChairSlots"
             WHERE "activationId" = ${activationId}
               AND "status" = 'FREE'
             ORDER BY "wave" ASC, "index" ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1
          )`,
        )
        .returning();

      if (!claimed) {
        throw new RabbitChairError("SOLD_OUT", "La silla está agotada", 409);
      }

      return claimed;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RabbitChairError(
        "ALREADY_CLAIMED",
        "Ya tienes un lugar en esta activación",
        409,
      );
    }
    throw error;
  }
}

export type CheckoutInput = {
  slotId: string;
  amountCents: number;
  paymentRef: string;
  userId?: string | null;
};

/**
 * Checkout SANDBOX de fase 1. No mueve dinero: valida reglas y marca el lugar
 * como pagado con una referencia única. En fase 2 el mismo contrato llama a
 * Stripe/terminal antes de marcar PAID.
 */
export async function checkoutSandbox(db: Db, input: CheckoutInput) {
  try {
    return await db.transaction(async (tx: any) => {
      const [slot] = await tx
        .select()
        .from(rabbitChairSlots)
        .where(eq(rabbitChairSlots.id, input.slotId))
        .for("update")
        .limit(1);

      if (!slot) {
        throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
      }

      if (slot.paymentRef && slot.paymentRef === input.paymentRef) {
        return { slot, idempotent: true };
      }

      if (slot.paymentStatus === "PAID") {
        throw new RabbitChairError(
          "PAYMENT_CONFLICT",
          "El lugar ya fue pagado con otra referencia",
          409,
        );
      }

      const [activation] = await tx
        .select()
        .from(rabbitChairActivations)
        .where(eq(rabbitChairActivations.id, slot.activationId))
        .limit(1);

      if (!activation) {
        throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
      }

      if (activation.chargeMode !== "PREPAID") {
        throw new RabbitChairError(
          "PAYMENT_REQUIRED",
          "Esta activación se cobra al final en el POS",
          409,
        );
      }

      if (slot.status !== "HELD") {
        throw new RabbitChairError("INVALID_STATE", "El lugar no está apartado", 409);
      }

      // PREPAID se cobra en la app: el lugar debe ser del mismo Rabbiter.
      // Un lugar de invitado (userId null) se cobra en el POS, no aquí.
      if (!input.userId || slot.userId !== input.userId) {
        throw new RabbitChairError(
          "FORBIDDEN",
          "Este lugar no está asociado a tu cuenta",
          403,
        );
      }

      if (input.amountCents < activation.minContributionCents) {
        throw new RabbitChairError(
          "AMOUNT_TOO_LOW",
          `La aportación mínima es de $${(activation.minContributionCents / 100).toFixed(0)}`,
        );
      }

      const [paid] = await tx
        .update(rabbitChairSlots)
        .set({
          status: "PAID",
          paymentStatus: "PAID",
          paidCents: Math.round(input.amountCents),
          paymentRef: input.paymentRef,
          updatedAt: sql`now()`,
        })
        .where(eq(rabbitChairSlots.id, input.slotId))
        .returning();

      const [remaining] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(rabbitChairSlots)
        .where(
          and(
            eq(rabbitChairSlots.activationId, activation.id),
            inArray(rabbitChairSlots.status, ["FREE", "HELD"]),
          ),
        );

      if ((remaining?.count ?? 0) === 0) {
        await tx
          .update(rabbitChairActivations)
          .set({ status: "SOLD_OUT", updatedAt: sql`now()` })
          .where(eq(rabbitChairActivations.id, activation.id));
      }

      return { slot: paid!, idempotent: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [existing] = await db
        .select()
        .from(rabbitChairSlots)
        .where(eq(rabbitChairSlots.paymentRef, input.paymentRef))
        .limit(1);

      if (existing && existing.id === input.slotId) {
        return { slot: existing, idempotent: true };
      }

      throw new RabbitChairError(
        "PAYMENT_CONFLICT",
        "La referencia de pago ya está en uso",
        409,
      );
    }
    throw error;
  }
}

export async function markSeated(db: Db, slotId: string) {
  const [slot] = await db
    .select()
    .from(rabbitChairSlots)
    .where(eq(rabbitChairSlots.id, slotId))
    .limit(1);

  if (!slot) {
    throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
  }

  if (slot.status === "SEATED" || slot.status === "SERVED" || slot.status === "DONE") {
    return slot;
  }

  if (!["HELD", "PAID"].includes(slot.status)) {
    throw new RabbitChairError("INVALID_STATE", "El lugar no se puede sentar", 409);
  }

  const [updated] = await db
    .update(rabbitChairSlots)
    .set({
      status: "SEATED",
      seatedAt: sql`COALESCE(${rabbitChairSlots.seatedAt}, now())`,
      updatedAt: sql`now()`,
    })
    .where(eq(rabbitChairSlots.id, slotId))
    .returning();

  return updated!;
}

/**
 * Marca servido y arranca el cronómetro. Idempotente: llamarlo dos veces no
 * reinicia los 10 minutos ni cambia `endsAt`.
 */
export async function markServed(db: Db, slotId: string) {
  return db.transaction(async (tx: any) => {
    const [slot] = await tx
      .select()
      .from(rabbitChairSlots)
      .where(eq(rabbitChairSlots.id, slotId))
      .for("update")
      .limit(1);

    if (!slot) {
      throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
    }

    if (slot.status === "SERVED" || slot.status === "DONE") {
      return slot;
    }

    if (!["PAID", "SEATED"].includes(slot.status)) {
      throw new RabbitChairError("INVALID_STATE", "El lugar aún no se puede servir", 409);
    }

    const [activation] = await tx
      .select({ durationMinutes: rabbitChairActivations.durationMinutes })
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, slot.activationId))
      .limit(1);

    const duration = activation?.durationMinutes ?? 10;

    const [updated] = await tx
      .update(rabbitChairSlots)
      .set({
        status: "SERVED",
        servedAt: sql`COALESCE(${rabbitChairSlots.servedAt}, now())`,
        endsAt: sql`COALESCE(${rabbitChairSlots.endsAt}, now() + (${duration} * interval '1 minute'))`,
        updatedAt: sql`now()`,
      })
      .where(eq(rabbitChairSlots.id, slotId))
      .returning();

    return updated!;
  });
}

export async function closeActivation(db: Db, activationId: string) {
  return db.transaction(async (tx: any) => {
    const [activation] = await tx
      .select()
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, activationId))
      .for("update")
      .limit(1);

    if (!activation) {
      throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
    }

    if (activation.status === "DONE") {
      return activation;
    }

    await tx
      .update(rabbitChairSlots)
      .set({ status: "EXPIRED", updatedAt: sql`now()` })
      .where(
        and(
          eq(rabbitChairSlots.activationId, activationId),
          inArray(rabbitChairSlots.status, ["FREE", "HELD"]),
        ),
      );

    const [updated] = await tx
      .update(rabbitChairActivations)
      .set({ status: "DONE", updatedAt: sql`now()` })
      .where(eq(rabbitChairActivations.id, activationId))
      .returning();

    return updated!;
  });
}

/**
 * Cancela un borrador y devuelve el crédito. Solo aplica a DRAFT: una
 * activación que ya se abrió se cierra, no se cancela (el crédito se consumió).
 * Idempotente: cancelar dos veces no devuelve dos créditos.
 */
export async function cancelActivation(db: Db, activationId: string) {
  return db.transaction(async (tx: any) => {
    const [activation] = await tx
      .select()
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, activationId))
      .for("update")
      .limit(1);

    if (!activation) {
      throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
    }

    if (activation.status === "CANCELLED") {
      return activation;
    }

    if (activation.status !== "DRAFT") {
      throw new RabbitChairError(
        "INVALID_STATE",
        "Solo se puede cancelar un borrador; una activación abierta se cierra",
        409,
      );
    }

    const [use] = await tx
      .delete(rabbitChairGrantUses)
      .where(eq(rabbitChairGrantUses.activationId, activationId))
      .returning();

    if (use) {
      await tx
        .update(rabbitChairGrants)
        .set({
          creditsUsed: sql`GREATEST(${rabbitChairGrants.creditsUsed} - 1, 0)`,
          updatedAt: sql`now()`,
        })
        .where(eq(rabbitChairGrants.id, use.grantId));
    }

    const [updated] = await tx
      .update(rabbitChairActivations)
      .set({ status: "CANCELLED", updatedAt: sql`now()` })
      .where(eq(rabbitChairActivations.id, activationId))
      .returning();

    return updated!;
  });
}

// ── Activación de la experiencia por el dueño ──────────────────────────────
// Sin este interruptor el POS no muestra "La Silla" y no se puede crear una
// activación. Es lo que evita que la experiencia aparezca "sola" en un tenant.

export async function isRabbitChairEnabled(db: Db, branchId: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: restaurants.rabbitChairEnabled })
    .from(branches)
    .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
    .where(eq(branches.id, branchId))
    .limit(1);
  return Boolean(row?.enabled);
}

export async function setRabbitChairEnabled(
  db: Db,
  branchId: string,
  enabled: boolean,
  userId?: string | null,
) {
  const [branch] = await db
    .select({ restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branch?.restaurantId) throw new RabbitChairError("NOT_FOUND", "Sucursal no encontrada", 404);

  await db
    .update(restaurants)
    .set({
      rabbitChairEnabled: enabled,
      rabbitChairEnabledAt: new Date(),
      rabbitChairEnabledBy: userId ?? null,
    })
    .where(eq(restaurants.id, branch.restaurantId));

  return { enabled };
}
