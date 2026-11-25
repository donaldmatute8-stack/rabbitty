import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  orderItems,
  payments,
  rabbitChairActivations,
  rabbitChairGrants,
  rabbitChairGrantUses,
  rabbitChairSlots,
  staff,
} from "@rabbitty/database-restaurant/schema";
import { createTestContext, closeTestDb } from "../test/setup";
import { rabbitChairRouter } from "./rabbitChair";
import {
  RabbitChairError,
  claimSlot,
  createGrant,
  listSlots,
} from "../services/rabbitChair";

/**
 * Fase 0/1: lo que se prueba aquí es lo que puede costar dinero o reputación.
 * · No sobreventa del último lugar.
 * · Checkout sandbox con mínimo e idempotencia.
 * · Servido idempotente y cronómetro estable.
 * · Hold vencido libera el lugar.
 * · Sin créditos no hay activación.
 * · POSTPAID no cobra en la app.
 */

describe("Rabbit Chair — integración (fase 0/1)", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof rabbitChairRouter.createCaller>;

  beforeAll(async () => {
    ctx = await createTestContext();
    caller = rabbitChairRouter.createCaller(ctx as never);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    // La experiencia exige activación explícita del dueño (Marketing). El test
    // corre contra la base local, así que la encendemos para probar el núcleo.
    await ctx.restaurantDb.execute(sql`UPDATE "restaurants" SET "rabbitChairEnabled" = true`);
    await ctx.restaurantDb.delete(rabbitChairGrantUses);
    await ctx.restaurantDb.delete(rabbitChairSlots);
    await ctx.restaurantDb.delete(rabbitChairActivations);
    await ctx.restaurantDb.delete(rabbitChairGrants);
    await createGrant(ctx.restaurantDb, { businessId: "b1", credits: 5 });
  });

  async function activationWithSlots(
    input: Parameters<typeof caller.activate>[0] = {},
  ) {
    const activation = await caller.activate({
      format: "BLOCK",
      capacity: 3,
      menuMode: "COFFEE",
      ...input,
    });
    await caller.open({ activationId: activation.id });
    return activation;
  }

  it("abre una activación y crea el cupo sin tocar otras ventas", async () => {
    const activation = await activationWithSlots({ capacity: 3 });
    const slots = await caller.slots({ activationId: activation.id });

    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot.status === "FREE")).toBe(true);
    expect(slots.every((slot) => slot.paymentStatus === "UNPAID")).toBe(true);

    const [grant] = await ctx.restaurantDb.select().from(rabbitChairGrants);
    expect(grant?.creditsUsed).toBe(1);
  });

  it("no sobrevende el último lugar con dos claims simultáneos", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
    });

    const results = await Promise.allSettled([
      claimSlot(ctx.restaurantDb, activation.id, { userId: "u1" }),
      claimSlot(ctx.restaurantDb, activation.id, { userId: "u2" }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RabbitChairError);
    expect(((rejected[0] as PromiseRejectedResult).reason as RabbitChairError).code).toBe(
      "SOLD_OUT",
    );

    const slots = await listSlots(ctx.restaurantDb, activation.id);
    expect(slots.filter((slot) => slot.status === "HELD")).toHaveLength(1);
  });

  it("checkout sandbox exige el mínimo y es idempotente", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
      minContributionCents: 8000,
    });
    const slot = await caller.claim({ activationId: activation.id });

    await expect(
      caller.checkout({ slotId: slot.id, amountCents: 4999, paymentRef: "ref-min-01" }),
    ).rejects.toThrow();

    await expect(
      caller.checkout({ slotId: slot.id, amountCents: 5000, paymentRef: "ref-min-02" }),
    ).rejects.toThrow(/mínima/i);

    const paid = await caller.checkout({
      slotId: slot.id,
      amountCents: 8000,
      paymentRef: "ref-ok-0001",
    });
    expect(paid.slot.status).toBe("PAID");
    expect(paid.slot.paymentStatus).toBe("PAID");
    expect(paid.idempotent).toBe(false);

    const again = await caller.checkout({
      slotId: slot.id,
      amountCents: 8000,
      paymentRef: "ref-ok-0001",
    });
    expect(again.idempotent).toBe(true);
    expect(again.slot.id).toBe(slot.id);
  });

  it("servir dos veces no reinicia los 10 minutos", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
    });
    const slot = await caller.claim({ activationId: activation.id });
    await caller.checkout({
      slotId: slot.id,
      amountCents: 5000,
      paymentRef: "ref-serve-01",
    });

    await caller.seat({ slotId: slot.id });
    const first = await caller.serve({ slotId: slot.id });
    const second = await caller.serve({ slotId: slot.id });

    expect(first.status).toBe("SERVED");
    expect(first.endsAt).toBeTruthy();
    expect(second.endsAt?.toISOString()).toBe(first.endsAt?.toISOString());
  });

  it("un hold vencido libera el lugar sin cron", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
    });
    const slot = await caller.claim({ activationId: activation.id });

    await ctx.restaurantDb
      .update(rabbitChairSlots)
      .set({ heldUntil: sql`now() - interval '1 minute'` })
      .where(sql`${rabbitChairSlots.id} = ${slot.id}`);

    const slots = await caller.slots({ activationId: activation.id });
    expect(slots[0]?.status).toBe("FREE");
    expect(slots[0]?.userId).toBeNull();
  });

  it("cerrar la activación impide tomar lugares nuevos", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
    });

    await caller.close({ activationId: activation.id });
    await expect(caller.claim({ activationId: activation.id })).rejects.toThrow(
      /no está abierta|agotada/i,
    );
  });

  it("sin créditos no se puede crear otra activación", async () => {
    await ctx.restaurantDb.delete(rabbitChairGrants);
    await ctx.restaurantDb.delete(rabbitChairGrantUses);
    await createGrant(ctx.restaurantDb, { businessId: "b1", credits: 1 });

    await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });

    await expect(
      caller.activate({ format: "SINGLE", menuMode: "COFFEE" }),
    ).rejects.toThrow(/no tiene activaciones/i);
  });

  it("POSTPAID no cobra en la app: se cobra al final en POS", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "POSTPAID",
    });
    const slot = await caller.claim({ activationId: activation.id });

    await expect(
      caller.checkout({
        slotId: slot.id,
        amountCents: 5000,
        paymentRef: "ref-post-01",
      }),
    ).rejects.toThrow(/al final/i);

    await caller.seat({ slotId: slot.id });
    const served = await caller.serve({ slotId: slot.id });
    expect(served.status).toBe("SERVED");
    expect(served.paymentStatus).toBe("UNPAID");
  });

  it("un Rabbiter no puede acaparar dos lugares de la misma activación", async () => {
    const activation = await activationWithSlots({
      format: "BLOCK",
      capacity: 2,
      chargeMode: "PREPAID",
    });

    await caller.claim({ activationId: activation.id });
    await expect(caller.claim({ activationId: activation.id })).rejects.toThrow(
      /ya tienes un lugar/i,
    );
  });

  it("dos claims simultáneos del mismo usuario dejan solo uno", async () => {
    const activation = await activationWithSlots({
      format: "BLOCK",
      capacity: 2,
      chargeMode: "PREPAID",
    });

    const results = await Promise.allSettled([
      claimSlot(ctx.restaurantDb, activation.id, { userId: "same-user" }),
      claimSlot(ctx.restaurantDb, activation.id, { userId: "same-user" }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(((rejected[0] as PromiseRejectedResult).reason as RabbitChairError).code).toBe(
      "ALREADY_CLAIMED",
    );
  });

  it("un lugar de invitado no se cobra desde la app", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
    });

    const slot = await caller.claimAtPos({
      activationId: activation.id,
      guestName: "Invitada",
    });

    await expect(
      caller.checkout({
        slotId: slot.id,
        amountCents: 5000,
        paymentRef: "ref-guest-01",
      }),
    ).rejects.toThrow(/no está asociado/i);
  });

  it("cancelar un borrador devuelve el crédito una sola vez", async () => {
    const activation = await caller.activate({
      format: "SINGLE",
      menuMode: "COFFEE",
    });

    const [before] = await ctx.restaurantDb
      .select()
      .from(rabbitChairGrants)
      .limit(1);
    expect(before?.creditsUsed).toBe(1);

    await caller.cancel({ activationId: activation.id });
    const [after] = await ctx.restaurantDb
      .select()
      .from(rabbitChairGrants)
      .limit(1);
    expect(after?.creditsUsed).toBe(0);

    await caller.cancel({ activationId: activation.id });
    const [again] = await ctx.restaurantDb
      .select()
      .from(rabbitChairGrants)
      .limit(1);
    expect(again?.creditsUsed).toBe(0);
  });

  it("si la carta incluye alcohol, exige verificación de edad", async () => {
    const activation = await caller.activate({
      format: "SINGLE",
      menuMode: "BOTH",
      requiresAgeCheck: false,
    });

    expect(activation.requiresAgeCheck).toBe(true);
  });

  it("A1: llenar el último lugar no congela la activación (sigue LIVE)", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "PREPAID",
    });

    await caller.claim({ activationId: activation.id });

    const [row] = await ctx.restaurantDb
      .select({ status: rabbitChairActivations.status })
      .from(rabbitChairActivations)
      .where(eq(rabbitChairActivations.id, activation.id))
      .limit(1);
    expect(row?.status).toBe("LIVE");

    // El POS conserva el tablero y sabe que está agotada (derivado).
    const board = await caller.active();
    expect(board.activation?.id).toBe(activation.id);
    expect((board as any).soldOut).toBe(true);
  });

  it("cobra en efectivo solo si la activación lo permite, con IVA por renglón", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "POSTPAID",
      cardOnly: false,
      minContributionCents: 5000,
    });
    const slot = await caller.claimAtPos({
      activationId: activation.id,
      guestName: "Efectivo",
    });

    const charged = await caller.checkoutAtPos({
      slotId: slot.id,
      amountCents: 5000,
      method: "CASH",
    });
    expect(charged.alreadyPaid).toBe(false);

    const [item] = await ctx.restaurantDb
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, charged.orderId))
      .limit(1);
    expect(Number(item?.taxRate)).toBeCloseTo(0.16, 2);
    // 50.00 con IVA incluido → 6.90 de IVA.
    expect(Number(item?.taxAmount)).toBeCloseTo(6.9, 1);

    const [payment] = await ctx.restaurantDb
      .select()
      .from(payments)
      .where(eq(payments.orderId, charged.orderId))
      .limit(1);
    expect(payment?.method).toBe("CASH");
  });

  it("con cardOnly el POS rechaza efectivo", async () => {
    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      chargeMode: "POSTPAID",
      minContributionCents: 5000,
    });
    const slot = await caller.claimAtPos({ activationId: activation.id });

    await expect(
      caller.checkoutAtPos({ slotId: slot.id, amountCents: 5000, method: "CASH" }),
    ).rejects.toThrow(/solo con tarjeta/i);
  });

  it("el historial de créditos muestra el uso y el restante", async () => {
    const activation = await activationWithSlots({ format: "SINGLE", capacity: 1 });

    const history = await caller.grants();
    expect(history.creditsRemaining).toBe(4);
    const use = history.grants[0]?.uses?.[0];
    expect(use?.activationId).toBe(activation.id);
    expect(use?.activationName).toBe(activation.name);
  });

  it("congela el costo del staff extra al crear la activación", async () => {
    const inserted = await ctx.restaurantDb
      .insert(staff)
      .values({
        userId: "staff-chair",
        branchId: "b1",
        name: "Barista de La Silla",
        email: `chair-staff-${Date.now()}@test.me`,
        role: "WAITER",
        hourlyRate: 120,
      })
      .returning();
    const member = inserted[0];
    if (!member) throw new Error("No se pudo crear el empleado de prueba");

    const activation = await activationWithSlots({
      format: "SINGLE",
      capacity: 1,
      staffId: member.id,
      staffMinutes: 90,
    });

    expect(activation.staffId).toBe(member.id);
    expect(activation.staffMinutes).toBe(90);
    // 120/h × 1.5 h = 180.00
    expect(activation.staffCostCents).toBe(18000);
  });

  it("permite cambiar solo tarjeta sin recompensar crédito", async () => {
    const activation = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    expect(activation.cardOnly).toBe(true);

    const updated = await caller.settings({ activationId: activation.id, cardOnly: false });
    expect(updated.cardOnly).toBe(false);

    const [grant] = await ctx.restaurantDb.select().from(rabbitChairGrants).limit(1);
    expect(grant?.creditsUsed).toBe(1);
  });

  it("las métricas responden por sucursal y por negocio", async () => {
    await activationWithSlots({ format: "BLOCK", capacity: 2 });

    const branch = await caller.metrics({ scope: "branch" });
    expect(branch.scope).toBe("branch");
    expect(branch.totals.activations).toBeGreaterThan(0);
    expect(branch.activations[0]?.capacity).toBe(2);

    const business = await caller.metrics({ scope: "business" });
    expect(business.scope).toBe("business");
    expect(business.totals.activations).toBeGreaterThan(0);
  });

  it("la audiencia de lista de espera avisa solo a quienes estuvieron en la fila", async () => {
    const previous = await activationWithSlots({ format: "SINGLE", capacity: 1 });
    await caller.joinWaitlist({ activationId: previous.id });
    await caller.close({ activationId: previous.id });

    const draft = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    const launched = await caller.launch({
      activationId: draft.id,
      audience: "WAITLIST",
    });

    expect(launched.audienceType).toBe("WAITLIST");
    expect(launched.audience).toBe(1);
    expect(launched.activation.status).toBe("LIVE");
  });

  it("sin nadie en la fila, la audiencia de espera no cae en un masivo", async () => {
    const draft = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });

    await expect(
      caller.launch({ activationId: draft.id, audience: "WAITLIST" }),
    ).rejects.toThrow(/fila de este negocio/i);
  });

  it("limita a un aviso masivo por día por negocio", async () => {
    const first = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    await ctx.restaurantDb
      .update(rabbitChairActivations)
      .set({ broadcastAt: sql`now()` })
      .where(eq(rabbitChairActivations.id, first.id));

    const second = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    await expect(
      caller.launch({
        activationId: second.id,
        audience: "ALL",
        allowBroadcast: true,
      }),
    ).rejects.toThrow(/últimas 24 horas/i);
  });

  it("una audiencia dirigida no consume el límite masivo", async () => {
    const first = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    await ctx.restaurantDb
      .update(rabbitChairActivations)
      .set({ broadcastAt: sql`now()` })
      .where(eq(rabbitChairActivations.id, first.id));

    const second = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });
    await expect(
      caller.launch({ activationId: second.id, audience: "WAITLIST" }),
    ).rejects.toThrow(/fila de este negocio/i);
  });

  it("la audiencia “todos” exige confirmación explícita", async () => {
    const draft = await caller.activate({ format: "SINGLE", menuMode: "COFFEE" });

    await expect(caller.launch({ activationId: draft.id, audience: "ALL" })).rejects.toThrow(
      /masivo/i,
    );
  });
});
