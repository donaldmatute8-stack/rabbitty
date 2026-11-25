import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { rabbitChairSlots } from "@rabbitty/database-restaurant/schema";
import { presenceSessions, users } from "@rabbitty/database-core/schema";
import { sendRabbitChairDrop, sendRabbitChairInvite } from "../services/rabbitChairDrop";
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
  checkoutSlotAtPos,
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
  convertWaitlistEntry,
  inviteNextWaiter,
  isRabbitChairEnabled,
  joinWaitlist,
  listWaitlist,
  scheduleRandomActivation,
  RabbitChairError,
  resolveBusinessId,
  setRabbitChairEnabled,
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
  /** ¿El dueño activó la experiencia en este negocio? */
  status: posProcedure.query(({ ctx }) =>
    run(async () => ({ enabled: await isRabbitChairEnabled(db(ctx), ctx.branchId) })),
  ),

  /**
   * Activar/desactivar Rabbit Chair. Solo el DUEÑO (sin ficha de staff):
   * es la "activación literal" que habilita la experiencia en el POS.
   */
  enable: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        if (ctx.staffRole) {
          throw new RabbitChairError(
            "FORBIDDEN",
            "Solo el dueño del negocio puede activar Rabbit Chair.",
            403,
          );
        }
        return setRabbitChairEnabled(db(ctx), ctx.branchId, input.enabled, ctx.userId ?? null);
      }),
    ),

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
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError(
          "INVALID_STATE",
          "Activa Rabbit Chair en Marketing → Rabbit Chair antes de crear una activación.",
        );
      }
      return createActivation(db(ctx), {
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
      });
    }),
  ),

  list: adminOnlyProcedure.query(({ ctx }) => run(() => listActivations(db(ctx), ctx.branchId))),

  open: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError("INVALID_STATE", "Rabbit Chair no está activado en este negocio.");
      }
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return openActivation(db(ctx), input.activationId);
    }),
  ),

  /** Sortear fecha dentro de la ventana (Bunzy). */
  scheduleRandom: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return scheduleRandomActivation(db(ctx), input.activationId);
    }),
  ),

  /**
   * Lanzar el drop: abre la activación y avisa a los Rabbitters.
   * Destino: presencia reciente en el negocio; si no hay, usuarios con push.
   */
  launch: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError("INVALID_STATE", "Rabbit Chair no está activado en este negocio.");
      }
      const activation = await activationInBranch(ctx, input.activationId, ctx.branchId);
      if (activation.status !== "DRAFT") {
        throw new RabbitChairError("INVALID_STATE", "Solo se puede lanzar una activación en borrador");
      }

      const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
      const opened = await openActivation(db(ctx), input.activationId);

      let userIds: string[] = [];
      try {
        const since = new Date(Date.now() - 60 * 86400_000);
        const rows = await ctx.coreDb
          .selectDistinct({ userId: presenceSessions.userId })
          .from(presenceSessions)
          .where(and(eq(presenceSessions.businessId, businessId), gte(presenceSessions.lastPingAt, since)))
          .limit(500);
        userIds = rows.map((r) => r.userId).filter(Boolean) as string[];

        if (userIds.length === 0) {
          const fallback = await ctx.coreDb
            .select({ id: users.id })
            .from(users)
            .where(eq(users.pushInAppEnabled, true))
            .limit(300);
          userIds = fallback.map((u) => u.id);
        }
      } catch (err) {
        console.warn("[rabbitChair.launch] no se pudo resolver audiencia:", err);
      }

      const notified = await sendRabbitChairDrop(userIds, {
        businessId,
        name: activation.name,
      });

      return { activation: opened, notified, audience: userIds.length };
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
      const enabled = await isRabbitChairEnabled(db(ctx), ctx.branchId);
      if (!enabled) return { enabled: false, activation: null, slots: [] };

      const activation = await getActiveActivation(db(ctx), ctx.branchId);
      if (!activation) return { enabled: true, activation: null, slots: [] };

      const slots = await listSlots(db(ctx), activation.id);

      // Si se liberó un lugar y hay fila, se invita al primero (una sola vez).
      if (slots.some((slot) => slot.status === "FREE")) {
        try {
          const invited = await inviteNextWaiter(db(ctx), activation.id);
          if (invited?.userId) {
            const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
            void sendRabbitChairInvite(invited.userId, {
              businessId,
              name: activation.name,
            });
          }
        } catch (err) {
          console.warn("[rabbitChair.active] invitación falló:", err);
        }
      }

      return { enabled: true, activation, slots };
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
      }).then(async (slot) => {
        await convertWaitlistEntry(db(ctx), input.activationId, ctx.userId ?? null);
        return slot;
      }),
    ),
  ),

  /** Entrar a la lista de espera cuando la silla está llena. */
  joinWaitlist: protectedProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(() =>
      joinWaitlist(db(ctx), input.activationId, { userId: ctx.userId ?? null }),
    ),
  ),

  /** POS/admin: quién está en la fila. */
  waitlist: posProcedure.input(activationInput).query(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return listWaitlist(db(ctx), input.activationId);
    }),
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

  /**
   * Cobro real del aporte en caja. Registra una orden normal (entra a caja,
   * reportes y conciliación) y marca el lugar como pagado.
   */
  checkoutAtPos: posPermission("POS_CHARGE")
    .input(
      z.object({
        slotId: z.string().min(1),
        amountCents: z.number().int().min(100).max(1_000_000),
        method: z.enum(["CARD", "CASH"]).default("CARD"),
        reference: z.string().trim().max(120).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return checkoutSlotAtPos(db(ctx), {
          slotId: input.slotId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference ?? null,
          staffId: ctx.posOperator?.staffId ?? null,
          terminalId: ctx.posAuth?.terminalId ?? null,
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
