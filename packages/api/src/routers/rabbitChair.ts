import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { rabbitChairSlots } from "@rabbitty/database-restaurant/schema";
import {
  adminOnlyProcedure,
  godAdminProcedure,
  posPermission,
  posProcedure,
  protectedProcedure,
  router,
} from "../trpc";
import {
  cancelActivation,
  checkoutSandbox,
  claimSlot,
  closeActivation,
  createActivation,
  createGrant,
  getActivation,
  getActiveActivation,
  grantSummary,
  listActivations,
  listSlots,
  markSeated,
  markServed,
  openActivation,
  RabbitChairError,
  resolveBusinessId,
  type Db,
} from "../services/rabbitChair";

/**
 * ── Rabbit Chair · router (Fase 0/1) ────────────────────────────────────────
 *
 * POS/admin/app sobre el mismo servicio. El cobro real está bloqueado: si
 * `RABBIT_CHAIR_PAYMENTS=live`, `checkout` responde PRECONDITION_FAILED hasta
 * que exista la integración de fase 2.
 */

function fail(error: unknown): never {
  if (error instanceof RabbitChairError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : error.code === "SOLD_OUT" ||
              error.code === "INVALID_STATE" ||
              error.code === "PAYMENT_CONFLICT" ||
              error.code === "ALREADY_CLAIMED"
            ? "CONFLICT"
            : error.code === "NO_CREDITS" || error.code === "PAYMENT_REQUIRED"
              ? "PRECONDITION_FAILED"
              : "BAD_REQUEST";

    throw new TRPCError({ code, message: error.message });
  }

  throw error;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    fail(error);
  }
}

function db(ctx: { restaurantDb: Db }): Db {
  return ctx.restaurantDb;
}

const activationInput = z.object({
  activationId: z.string().min(1),
});

const formatSchema = z.enum(["SINGLE", "BLOCK", "WAVES", "COUPLES"]);
const chargeModeSchema = z.enum(["PREPAID", "POSTPAID"]);
const menuModeSchema = z.enum(["COFFEE", "ALCOHOL", "BOTH"]);

const activateInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  format: formatSchema.default("BLOCK"),
  capacity: z.number().int().min(1).max(50).optional(),
  partySize: z.number().int().min(1).max(4).optional(),
  waveMinutes: z.number().int().min(5).max(240).nullish(),
  chargeMode: chargeModeSchema.default("PREPAID"),
  minContributionCents: z.number().int().min(5000).max(1_000_000).default(5000),
  durationMinutes: z.number().int().min(1).max(60).default(10),
  menuMode: menuModeSchema.default("BOTH"),
  requiresAgeCheck: z.boolean().optional(),
  playlist: z.string().trim().max(200).nullish(),
  lightPreset: z.string().trim().max(80).nullish(),
  bartenderMode: z.enum(["FIXED", "ROTATING"]).default("ROTATING"),
  randomWindowFrom: z.string().datetime().nullish(),
  randomWindowTo: z.string().datetime().nullish(),
  radiusMeters: z.number().int().min(50).max(20_000).nullish(),
});

async function activationInBranch(ctx: { restaurantDb: Db }, activationId: string, branchId: string) {
  const activation = await getActivation(db(ctx), activationId);

  if (activation.branchId !== branchId) {
    throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
  }

  return activation;
}

async function slotInBranch(ctx: { restaurantDb: Db }, slotId: string, branchId: string) {
  const [slot] = await db(ctx)
    .select({ activationId: rabbitChairSlots.activationId })
    .from(rabbitChairSlots)
    .where(eq(rabbitChairSlots.id, slotId))
    .limit(1);

  if (!slot) {
    throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
  }

  await activationInBranch(ctx, slot.activationId, branchId);
  return slot;
}

export const rabbitChairRouter = router({
  /**
   * God: otorga créditos a un negocio. Es la puerta de acceso al producto;
   * sin grant activo no se puede crear una activación.
   */
  grant: godAdminProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        credits: z.number().int().min(1).max(1000),
        days: z.number().int().min(1).max(365).default(30),
        requestId: z.string().min(1).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        createGrant(db(ctx), {
          businessId: input.businessId,
          credits: input.credits,
          days: input.days,
          requestId: input.requestId ?? null,
          createdBy: ctx.userId ?? null,
        }),
      ),
    ),

  /** Admin del negocio: resumen de créditos (módulo La Silla). */
  credits: adminOnlyProcedure.query(({ ctx }) =>
    run(async () => {
      const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
      return grantSummary(db(ctx), businessId);
    }),
  ),

  activate: adminOnlyProcedure.input(activateInput).mutation(({ ctx, input }) =>
    run(() =>
      createActivation(db(ctx), {
        branchId: ctx.branchId,
        name: input.name,
        format: input.format,
        capacity: input.capacity,
        partySize: input.partySize,
        waveMinutes: input.waveMinutes ?? null,
        chargeMode: input.chargeMode,
        minContributionCents: input.minContributionCents,
        durationMinutes: input.durationMinutes,
        menuMode: input.menuMode,
        requiresAgeCheck: input.requiresAgeCheck,
        playlist: input.playlist ?? null,
        lightPreset: input.lightPreset ?? null,
        bartenderMode: input.bartenderMode,
        randomWindowFrom: input.randomWindowFrom ? new Date(input.randomWindowFrom) : null,
        randomWindowTo: input.randomWindowTo ? new Date(input.randomWindowTo) : null,
        radiusMeters: input.radiusMeters ?? null,
        createdBy: ctx.userId ?? null,
      }),
    ),
  ),

  list: adminOnlyProcedure.query(({ ctx }) => run(() => listActivations(db(ctx), ctx.branchId))),

  open: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return openActivation(db(ctx), input.activationId);
    }),
  ),

  close: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return closeActivation(db(ctx), input.activationId);
    }),
  ),

  cancel: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return cancelActivation(db(ctx), input.activationId);
    }),
  ),

  /** POS: activación LIVE + lugares en una sola llamada. */
  active: posProcedure.query(({ ctx }) =>
    run(async () => {
      const activation = await getActiveActivation(db(ctx), ctx.branchId);

      if (!activation) {
        return { activation: null, slots: [] };
      }

      return {
        activation,
        slots: await listSlots(db(ctx), activation.id),
      };
    }),
  ),

  slots: posProcedure.input(activationInput).query(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return listSlots(db(ctx), input.activationId);
    }),
  ),

  /** App: el Rabbiter toma un lugar (hold de 5 minutos). */
  claim: protectedProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(() =>
      claimSlot(db(ctx), input.activationId, {
        userId: ctx.userId ?? null,
      }),
    ),
  ),

  /** POS: la casa aparta un lugar para un invitado (sin cuenta en la app). */
  claimAtPos: posProcedure
    .input(
      z.object({
        activationId: z.string().min(1),
        guestName: z.string().trim().max(120).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await activationInBranch(ctx, input.activationId, ctx.branchId);
        return claimSlot(db(ctx), input.activationId, {
          guestName: input.guestName ?? null,
        });
      }),
    ),

  /**
   * Checkout SANDBOX. En fase 2 el cobro real (Stripe/terminal) se conecta
   * antes de este paso; mientras, `RABBIT_CHAIR_PAYMENTS=live` lo bloquea.
   */
  checkout: protectedProcedure
    .input(
      z.object({
        slotId: z.string().min(1),
        amountCents: z.number().int().min(5000).max(1_000_000),
        paymentRef: z.string().trim().min(6).max(120),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        // Fail-closed: sin `RABBIT_CHAIR_PAYMENTS=sandbox` explícito, el
        // checkout no corre. En producción se queda apagado hasta fase 2.
        if (process.env.RABBIT_CHAIR_PAYMENTS !== "sandbox") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "El cobro de Rabbit Chair aún no está habilitado.",
          });
        }

        return checkoutSandbox(db(ctx), {
          slotId: input.slotId,
          amountCents: input.amountCents,
          paymentRef: input.paymentRef,
          userId: ctx.userId ?? null,
        });
      }),
    ),

  seat: posPermission("POS_CHARGE")
    .input(z.object({ slotId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return markSeated(db(ctx), input.slotId);
      }),
    ),

  serve: posPermission("POS_CHARGE")
    .input(z.object({ slotId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return markServed(db(ctx), input.slotId);
      }),
    ),
});
