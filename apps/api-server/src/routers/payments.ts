import { z } from "zod";
import { router, protectedProcedure, tenantProcedure } from "./trpc";
import { PaymentIntentService } from "../domain/payments/intent";

export const paymentsRouter = router({
  createIntent: tenantProcedure
    .input(z.object({
      amountMxn: z.number().positive(),
      tenantId: z.string().optional(),
      orderId: z.string().optional(),
      idempotencyKey: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validates capability within this specific tenant
      if (!ctx.principal.capabilities.includes("pos:checkout")) {
        throw new Error("Missing capability to create payment intents.");
      }

      const activeTenantId = ctx.principal.tenantId || input.tenantId;
      if (!activeTenantId) {
        throw new Error("Operation requires an active tenant context.");
      }

      // 2. Creates the intent safely on the backend
      const intent = await PaymentIntentService.createIntent({
        tenantId: activeTenantId,
        creatorSubjectId: ctx.principal.subjectId,
        amountMxn: input.amountMxn,
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey
      });

      return intent;
    }),

  getIntent: protectedProcedure
    .input(z.object({
      intentId: z.string()
    }))
    .query(async ({ input }) => {
      // Both the POS and the TMA need to be able to resolve intents.
      // We don't enforce tenant-only access here because the TMA 
      // (a different tenant or public space) needs to scan and read the QR.
      // However, we only return safe public fields, without leaking internal PII / idempotency keys.
      const intent = await PaymentIntentService.getIntent(input.intentId);
      if (!intent) {
        throw new Error("INTENT_NOT_FOUND");
      }
      return {
        id: intent.id,
        tenantId: intent.tenantId,
        orderId: intent.orderId,
        amountMxn: intent.amountMxn,
        bunzAmount: intent.bunzAmount,
        currency: intent.currency,
        status: intent.status,
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt,
      };
    }),

  approveIntent: protectedProcedure
    .input(z.object({
      intentId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.principal.capabilities.includes("bunz:spend")) {
        throw new Error("Missing capability to spend Bunz.");
      }

      // Approve intent (locks the intent to this payer and settles atomically)
      const intent = await PaymentIntentService.approveIntent(input.intentId, ctx.principal.subjectId);
      return intent;
    })
});
