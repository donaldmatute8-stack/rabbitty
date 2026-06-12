import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { orders } from "@rabbitty/database-restaurant/schema";
import { billingProfiles } from "@rabbitty/database-core/schema";

export const customerRouter = router({
  lookupCustomer: protectedProcedure
    .input(z.object({ phone: z.string().optional(), email: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.phone) {
        const [customer] = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerPhone, input.phone));
        return customer ? { found: true, ...customer } : { found: false };
      } else if (input.email) {
        const [customer] = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerId, input.email));
        return customer ? { found: true, ...customer } : { found: false };
      }
      return { found: false };
    }),

  getCustomerHistory: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerPhone, input.phone));
      return { phone: input.phone, orders: result };
    }),

  getBillingProfiles: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return [];
    return await ctx.coreDb.select().from(billingProfiles).where(eq(billingProfiles.userId, ctx.userId));
  }),

  createBillingProfile: protectedProcedure
    .input(z.object({
      rfc: z.string(),
      legalName: z.string(),
      taxRegime: z.string(),
      zipCode: z.string(),
      cfdiUse: z.string(),
      email: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new Error("No autenticado");
      
      const existing = await ctx.coreDb.select().from(billingProfiles).where(eq(billingProfiles.userId, ctx.userId));
      const isDefault = existing.length === 0;

      const [profile] = await ctx.coreDb.insert(billingProfiles).values({
        userId: ctx.userId,
        ...input,
        isDefault,
      }).returning();
      
      return profile;
    }),

  requestInvoice: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      billingProfileId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar perfil
      const [profile] = await ctx.coreDb.select().from(billingProfiles).where(eq(billingProfiles.id, input.billingProfileId));
      if (!profile) throw new Error("Perfil de facturación no encontrado");

      // Verificar orden
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");
      if (order.cfdiStatus === "INVOICED") throw new Error("Esta orden ya fue facturada");

      // Validar monto facturable (Dinero real, no Bunz)
      const bunzPaid = order.bunzPaid || 0;
      const billableAmount = order.total - bunzPaid;
      
      if (billableAmount <= 0) {
        throw new Error("El monto facturable debe ser mayor a 0. Las órdenes pagadas al 100% con Bunz no generan CFDI.");
      }

      // Simulación de emisión de CFDI con un PAC externo usando 'billableAmount'
      const mockPdfUrl = `https://rabbitty.mx/invoices/${input.orderId}.pdf`;

      // Guardar status
      await ctx.restaurantDb.update(orders)
        .set({ cfdiStatus: "INVOICED", cfdiUrl: mockPdfUrl })
        .where(eq(orders.id, input.orderId));

      return { success: true, url: mockPdfUrl, billableAmount };
    }),
});
