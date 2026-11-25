import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  branches,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  payments,
  rabbitChairActivations,
  rabbitChairGrants,
  rabbitChairGrantUses,
  rabbitChairSlots,
  rabbitChairWaitlist,
  restaurants,
  staff,
} from "@rabbitty/database-restaurant/schema";
import type { getRestaurantDb } from "../db";
import { withOrderCreate } from "./orderIntegrity";

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
  /** Si es true, el POS no ofrece efectivo. Default true (seguro). */
  cardOnly?: boolean;
  /** Empleado extra (bartender/barista) asignado a la activación. */
  staffId?: string | null;
  /** Minutos pagados del empleado extra. Sin valor = duración de la activación. */
  staffMinutes?: number | null;
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

  // Costo del empleado extra: se congela al crear (si cambia su tarifa después,
  // la activación conserva el costo con el que se planeó).
  const staffMinutes = Math.min(
    24 * 60,
    Math.max(0, Math.round(Number(input.staffMinutes ?? durationMinutes) || 0)),
  );
  let staffCostCents = 0;
  if (input.staffId) {
    const [member] = await db
      .select({ branchId: staff.branchId, hourlyRate: staff.hourlyRate, isActive: staff.isActive })
      .from(staff)
      .where(eq(staff.id, input.staffId))
      .limit(1);
    if (!member || member.branchId !== input.branchId) {
      throw new RabbitChairError(
        "INVALID_STATE",
        "El empleado asignado no pertenece a esta sucursal",
        400,
      );
    }
    if (!member.isActive) {
      throw new RabbitChairError("INVALID_STATE", "El empleado asignado está inactivo", 400);
    }
    staffCostCents = Math.round(Number(member.hourlyRate ?? 0) * (staffMinutes / 60) * 100);
  }

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
        cardOnly: input.cardOnly ?? true,
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
        staffId: input.staffId ?? null,
        staffMinutes: input.staffId ? staffMinutes : 0,
        staffCostCents,
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
  // A1: la activación sigue LIVE aunque no queden lugares (la UI deriva
  // "agotada"). Se acepta SOLD_OUT solo por filas legadas del checkout sandbox,
  // para que el POS no pierda el tablero en plena operación.
  const [activation] = await db
    .select()
    .from(rabbitChairActivations)
    .where(
      and(
        eq(rabbitChairActivations.branchId, branchId),
        inArray(rabbitChairActivations.status, ["LIVE", "SOLD_OUT"]),
      ),
    )
    .orderBy(sql`(${rabbitChairActivations.status} = 'LIVE') DESC`)
    .limit(1);

  return activation ?? null;
}

async function expireStale(tx: any, activationId: string): Promise<number> {
  const released = await tx
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
    )
    .returning({ id: rabbitChairSlots.id });

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

  return Array.isArray(released) ? released.length : 0;
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

      if (!["LIVE", "SOLD_OUT"].includes(activation.status)) {
        throw new RabbitChairError("INVALID_STATE", "La activación no está abierta", 409);
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
          // PREPAID pasa por Stripe: 15 min de hold; el resto, 5.
          heldUntil: sql`now() + interval '${sql.raw(String(activation.chargeMode === "PREPAID" ? 15 : 5))} minutes'`,
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

      // A1: "agotada" se deriva en lectura (slots libres = 0). No se persiste
      // SOLD_OUT para no dejar la activación congelada si un hold expira.
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

/**
 * Ajustes editables de una activación abierta o en borrador. Hoy: solo tarjeta
 * (efectivo en POS) y radio de proximidad. No toca cupo, precio ni créditos.
 */
export async function updateActivationSettings(
  db: Db,
  activationId: string,
  input: { cardOnly?: boolean; radiusMeters?: number | null },
) {
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
    if (!["DRAFT", "LIVE", "SOLD_OUT"].includes(activation.status)) {
      throw new RabbitChairError(
        "INVALID_STATE",
        "Solo se puede ajustar una activación en borrador o abierta",
        409,
      );
    }

    const patch: Record<string, unknown> = { updatedAt: sql`now()` };
    if (typeof input.cardOnly === "boolean") patch.cardOnly = input.cardOnly;
    if (input.radiusMeters !== undefined) {
      patch.radiusMeters =
        input.radiusMeters == null
          ? null
          : Math.min(20_000, Math.max(50, Math.round(input.radiusMeters)));
    }

    const [updated] = await tx
      .update(rabbitChairActivations)
      .set(patch)
      .where(eq(rabbitChairActivations.id, activationId))
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

/**
 * Política de avisos masivos de La Silla para un negocio.
 * Defaults: 1 por día y 100 destinatarios. God puede ajustarlo por negocio.
 */
export async function getRabbitChairBroadcastPolicy(db: Db, businessId: string) {
  const [row] = await db
    .select({
      dailyLimit: restaurants.rabbitChairMassDailyLimit,
      recipientCap: restaurants.rabbitChairMassRecipientCap,
    })
    .from(restaurants)
    .where(eq(restaurants.businessId, businessId))
    .limit(1);

  return {
    dailyLimit: Math.max(0, Number(row?.dailyLimit ?? 1)),
    recipientCap: Math.min(5000, Math.max(1, Number(row?.recipientCap ?? 100))),
  };
}

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

/**
 * ── Fecha aleatoria (Bunzy) ────────────────────────────────────────────────
 * Toma la ventana configurada y elige un instante al azar, redondeado a 15
 * minutos y con al menos 15 minutos de margen. No abre la activación: solo
 * fija cuándo se revela.
 */
export async function scheduleRandomActivation(db: Db, activationId: string) {
  const activation = await getActivation(db, activationId);
  if (activation.status !== "DRAFT") {
    throw new RabbitChairError("INVALID_STATE", "Solo se puede sortear una activación en borrador");
  }

  const from = activation.randomWindowFrom ? new Date(activation.randomWindowFrom).getTime() : 0;
  const to = activation.randomWindowTo ? new Date(activation.randomWindowTo).getTime() : 0;
  if (!from || !to || to <= from) {
    throw new RabbitChairError("INVALID_STATE", "Define la ventana (desde / hasta) antes de sortear");
  }

  const earliest = Math.max(from, Date.now() + 15 * 60_000);
  if (to <= earliest) {
    throw new RabbitChairError("INVALID_STATE", "La ventana ya no tiene tiempo disponible");
  }

  const step = 15 * 60_000;
  const slots = Math.max(1, Math.floor((to - earliest) / step));
  const pick = earliest + Math.floor(Math.random() * slots) * step;
  const startsAt = new Date(pick);

  await db
    .update(rabbitChairActivations)
    .set({ startsAt, revealAt: startsAt, updatedAt: new Date() })
    .where(eq(rabbitChairActivations.id, activationId));

  return { startsAt };
}

// ── Lista de espera ─────────────────────────────────────────────────────────

/** Entra a la fila cuando la activación está llena. */
export async function joinWaitlist(db: Db, activationId: string, input: ClaimInput) {
  return db.transaction(async (tx: any) => {
    // Lock de la activación: las posiciones de la fila se asignan en serie.
    const [activation] = await tx
      .select({ status: rabbitChairActivations.status })
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, activationId))
      .for("update")
      .limit(1);

    if (!activation) throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
    if (!["LIVE", "SOLD_OUT"].includes(activation.status)) {
      throw new RabbitChairError("INVALID_STATE", "La activación no está abierta");
    }

    if (input.userId) {
      const [existing] = await tx
        .select()
        .from(rabbitChairWaitlist)
        .where(
          and(
            eq(rabbitChairWaitlist.activationId, activationId),
            eq(rabbitChairWaitlist.userId, input.userId),
            inArray(rabbitChairWaitlist.status, ["WAITING", "INVITED"]),
          ),
        )
        .limit(1);
      if (existing) {
        return { id: existing.id, position: existing.position, already: true, status: existing.status };
      }
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(rabbitChairWaitlist)
      .where(
        and(
          eq(rabbitChairWaitlist.activationId, activationId),
          inArray(rabbitChairWaitlist.status, ["WAITING", "INVITED"]),
        ),
      );

    const position = Number(countRow?.count ?? 0) + 1;
    const [row] = await tx
      .insert(rabbitChairWaitlist)
      .values({
        id: randomUUID(),
        activationId,
        userId: input.userId ?? null,
        guestName: input.guestName?.trim() || null,
        position,
        status: "WAITING",
      })
      .returning();

    return { id: row.id, position, already: false, status: "WAITING" };
  });
}

export async function listWaitlist(db: Db, activationId: string) {
  return db
    .select()
    .from(rabbitChairWaitlist)
    .where(eq(rabbitChairWaitlist.activationId, activationId))
    .orderBy(asc(rabbitChairWaitlist.position));
}

/**
 * Invita al primero de la fila si hay lugar libre y nadie tiene una invitación
 * vigente. Devuelve el invitado (o null).
 */
export async function inviteNextWaiter(db: Db, activationId: string, ttlMinutes = 10) {
  return db.transaction(async (tx: any) => {
    // Lock de la activación: dos terminales no invitan a la vez.
    await tx
      .select({ id: rabbitChairActivations.id })
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, activationId))
      .for("update")
      .limit(1);

    await tx
      .update(rabbitChairWaitlist)
      .set({ status: "EXPIRED", updatedAt: sql`now()` })
      .where(
        and(
          eq(rabbitChairWaitlist.activationId, activationId),
          eq(rabbitChairWaitlist.status, "INVITED"),
          sql`${rabbitChairWaitlist.expiresAt} < now()`,
        ),
      );

    const [activeInvite] = await tx
      .select({ id: rabbitChairWaitlist.id })
      .from(rabbitChairWaitlist)
      .where(
        and(
          eq(rabbitChairWaitlist.activationId, activationId),
          eq(rabbitChairWaitlist.status, "INVITED"),
        ),
      )
      .limit(1);
    if (activeInvite) return null;

    const [freeSlot] = await tx
      .select({ id: rabbitChairSlots.id })
      .from(rabbitChairSlots)
      .where(
        and(eq(rabbitChairSlots.activationId, activationId), eq(rabbitChairSlots.status, "FREE")),
      )
      .limit(1);
    if (!freeSlot) return null;

    const [next] = await tx
      .select()
      .from(rabbitChairWaitlist)
      .where(
        and(
          eq(rabbitChairWaitlist.activationId, activationId),
          eq(rabbitChairWaitlist.status, "WAITING"),
        ),
      )
      .orderBy(asc(rabbitChairWaitlist.position))
      .limit(1);
    if (!next) return null;

    const [invited] = await tx
      .update(rabbitChairWaitlist)
      .set({
        status: "INVITED",
        invitedAt: sql`now()`,
        expiresAt: sql`now() + (${ttlMinutes} || ' minutes')::interval`,
        updatedAt: sql`now()`,
      })
      .where(eq(rabbitChairWaitlist.id, next.id))
      .returning();

    return invited;
  });
}

/** Marca la invitación como convertida cuando la persona toma su lugar. */
export async function convertWaitlistEntry(db: Db, activationId: string, userId: string | null) {
  if (!userId) return;
  await db
    .update(rabbitChairWaitlist)
    .set({ status: "CONVERTED", updatedAt: sql`now()` })
    .where(
      and(
        eq(rabbitChairWaitlist.activationId, activationId),
        eq(rabbitChairWaitlist.userId, userId),
        inArray(rabbitChairWaitlist.status, ["WAITING", "INVITED"]),
      ),
    );
}

// ── Cobro real en el POS ────────────────────────────────────────────────────
// El aporte se cobra en caja (tarjeta o efectivo si el negocio lo permite) y
// se registra como una orden normal: entra a caja, reportes y conciliación.

async function ensureChairMenuItem(tx: any, branchId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.branchId, branchId), eq(menuItems.name, "La Silla")))
    .limit(1);
  if (existing?.id) return existing.id as string;

  let [category] = await tx
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.branchId, branchId), eq(menuCategories.name, "Rabbit Chair")))
    .limit(1);
  if (!category?.id) {
    const [created] = await tx
      .insert(menuCategories)
      .values({ branchId, name: "Rabbit Chair", sortOrder: 998, isActive: false })
      .returning({ id: menuCategories.id });
    category = created;
  }

  const [createdItem] = await tx
    .insert(menuItems)
    .values({
      branchId,
      categoryId: category.id,
      name: "La Silla",
      description: "Aporte de Rabbit Chair",
      price: 0,
      kind: "DISH",
      isActive: false,
      isAvailable: false,
    })
    .returning({ id: menuItems.id });
  return createdItem.id as string;
}

export type PosCheckoutInput = {
  slotId: string;
  amountCents: number;
  method: "CARD" | "CASH";
  reference?: string | null;
  staffId?: string | null;
  terminalId?: string | null;
};

export async function checkoutSlotAtPos(db: Db, input: PosCheckoutInput) {
  return db.transaction(async (tx: any) => {
    // Lock de la fila: dos cajas no pueden cobrar el mismo lugar a la vez.
    const [slot] = await tx
      .select()
      .from(rabbitChairSlots)
      .where(eq(rabbitChairSlots.id, input.slotId))
      .for("update")
      .limit(1);
    if (!slot) throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);

    if (slot.status === "PAID") {
      return { alreadyPaid: true, orderId: slot.orderId, amountCents: Number(slot.paidCents ?? 0) };
    }
    if (!["HELD", "SEATED"].includes(slot.status)) {
      throw new RabbitChairError("INVALID_STATE", "Toma el lugar antes de cobrar");
    }

    const [activation] = await tx
      .select()
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, slot.activationId))
      .limit(1);
    if (!activation) throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);

    if (input.amountCents < Number(activation.minContributionCents)) {
      throw new RabbitChairError("PAYMENT_REQUIRED", "El aporte está por debajo del mínimo");
    }
    if (activation.cardOnly && input.method === "CASH") {
      throw new RabbitChairError("INVALID_STATE", "Esta experiencia es solo con tarjeta");
    }

    const total = Math.round(input.amountCents) / 100;
    const subtotal = Math.round((total / 1.16) * 100) / 100;
    const tax = Math.round((total - subtotal) * 100) / 100;
    const menuItemId = await ensureChairMenuItem(tx, activation.branchId);

    const order = await withOrderCreate(
      tx,
      { actor: { staffId: input.staffId ?? null, terminalId: input.terminalId ?? null } },
      async () => {
        const [row] = await tx
          .insert(orders)
          .values({
            branchId: activation.branchId,
            orderType: "TO_GO",
            status: "PAID",
            channel: "RABBIT_CHAIR",
            customerName: slot.guestName ?? null,
            notes: `Rabbit Chair · ${activation.name}`,
            subtotal,
            tax,
            total,
            version: 1,
          })
          .returning({ id: orders.id });

        await tx.insert(orderItems).values({
          orderId: row.id,
          menuItemId,
          nameSnapshot: "La Silla",
          quantity: 1,
          unitPrice: total,
          totalPrice: total,
          sortOrder: 0,
          status: "SERVED",
          // IVA por renglón (columna 0035): contabilidad necesita el dato real
          // de la línea, no el fallback del negocio.
          taxRate: 0.16,
          taxAmount: tax,
        });

        await tx.insert(payments).values({
          orderId: row.id,
          method: input.method === "CASH" ? "CASH" : "CREDIT_CARD",
          amount: total,
          status: "COMPLETED",
          reference: input.reference ?? null,
          verificationMethod: "CASHIER_CONFIRMED",
        });

        return row;
      },
    );

    await tx
      .update(rabbitChairSlots)
      .set({
        status: "PAID",
        orderId: order.id,
        paidCents: input.amountCents,
        paymentRef: input.reference ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(rabbitChairSlots.id, input.slotId));

    return { alreadyPaid: false, orderId: order.id, amountCents: input.amountCents };
  });
}

/**
 * ── Pago confirmado por Stripe (Checkout) ──────────────────────────────────
 * El webhook de Stripe llama aquí cuando se completa el pago del aporte.
 * Es idempotente: si el lugar ya está pagado, no crea otra orden.
 */
export async function markSlotPaidFromStripe(
  db: Db,
  input: { slotId: string; amountCents: number; ref: string; userId?: string | null },
) {
  return db.transaction(async (tx: any) => {
    const [slot] = await tx
      .select()
      .from(rabbitChairSlots)
      .where(eq(rabbitChairSlots.id, input.slotId))
      .for("update")
      .limit(1);
    if (!slot) throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
    if (slot.status === "PAID") return { alreadyPaid: true, orderId: slot.orderId };

    const [activation] = await tx
      .select()
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, slot.activationId))
      .limit(1);
    if (!activation) throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);

    const total = Math.max(0, Math.round(input.amountCents)) / 100;
    const subtotal = Math.round((total / 1.16) * 100) / 100;
    const tax = Math.round((total - subtotal) * 100) / 100;
    const menuItemId = await ensureChairMenuItem(tx, activation.branchId);

    const order = await withOrderCreate(tx, { actor: { staffId: null, terminalId: null } }, async () => {
      const [row] = await tx
        .insert(orders)
        .values({
          branchId: activation.branchId,
          orderType: "TO_GO",
          status: "PAID",
          channel: "RABBIT_CHAIR",
          customerName: slot.guestName ?? null,
          notes: `Rabbit Chair · ${activation.name} · Stripe`,
          subtotal,
          tax,
          total,
          version: 1,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values({
        orderId: row.id,
        menuItemId,
        nameSnapshot: "La Silla",
        quantity: 1,
        unitPrice: total,
        totalPrice: total,
        sortOrder: 0,
        status: "SERVED",
        taxRate: 0.16,
        taxAmount: tax,
      });

      await tx.insert(payments).values({
        orderId: row.id,
        method: "CREDIT_CARD",
        amount: total,
        status: "COMPLETED",
        reference: input.ref,
        verificationMethod: "PROVIDER_WEBHOOK",
      });

      return row;
    });

    await tx
      .update(rabbitChairSlots)
      .set({
        status: "PAID",
        orderId: order.id,
        paidCents: Math.round(input.amountCents),
        paymentRef: input.ref,
        updatedAt: sql`now()`,
      })
      .where(eq(rabbitChairSlots.id, input.slotId));

    await tx
      .update(rabbitChairWaitlist)
      .set({ status: "CONVERTED", updatedAt: sql`now()` })
      .where(
        and(
          eq(rabbitChairWaitlist.activationId, slot.activationId),
          input.userId
            ? eq(rabbitChairWaitlist.userId, input.userId)
            : eq(rabbitChairWaitlist.userId, String(slot.userId ?? "")),
          inArray(rabbitChairWaitlist.status, ["WAITING", "INVITED"]),
        ),
      );

    return { alreadyPaid: false, orderId: order.id };
  });
}
