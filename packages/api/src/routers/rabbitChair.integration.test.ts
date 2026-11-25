import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  rabbitChairActivations,
  rabbitChairGrants,
  rabbitChairGrantUses,
  rabbitChairSlots,
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
});
