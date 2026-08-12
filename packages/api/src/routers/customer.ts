import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { orders, invoices, branches } from "@rabbitty/database-restaurant";
import { billingProfiles } from "@rabbitty/database-core/schema";
import { encryptText, decryptText } from "../services/crypto";

export const customerRouter = router({
  lookupCustomer: protectedProcedure
    .input(z.object({ phone: z.string().optional(), email: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchScope = ctx.staffRole ? eq(orders.branchId, ctx.staffBranchId as string) : undefined;
      if (input.phone) {
        const customerWhere = branchScope
          ? and(eq(orders.customerPhone, input.phone), branchScope)
          : eq(orders.customerPhone, input.phone);
        const [customer] = await ctx.restaurantDb.select().from(orders).where(customerWhere);
        return customer ? { found: true, ...customer } : { found: false };
      } else if (input.email) {
        const customerWhere = branchScope
          ? and(eq(orders.customerId, input.email), branchScope)
          : eq(orders.customerId, input.email);
        const [customer] = await ctx.restaurantDb.select().from(orders).where(customerWhere);
        return customer ? { found: true, ...customer } : { found: false };
      }
      return { found: false };
    }),

  getCustomerHistory: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const customerWhere = ctx.staffRole
        ? and(eq(orders.customerPhone, input.phone), eq(orders.branchId, ctx.staffBranchId as string))
        : eq(orders.customerPhone, input.phone);
      const result = await ctx.restaurantDb.select().from(orders).where(customerWhere);
      return { phone: input.phone, orders: result };
    }),

  getBillingProfiles: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return [];
    const profiles = await ctx.coreDb.select().from(billingProfiles).where(eq(billingProfiles.userId, ctx.userId));
    return profiles.map(profile => ({
      ...profile,
      rfc: decryptText(profile.rfc),
      legalName: decryptText(profile.legalName),
    }));
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
        rfc: encryptText(input.rfc),
        legalName: encryptText(input.legalName),
        isDefault,
      }).returning();
      
      if (!profile) {
        throw new Error("Error al crear el perfil de facturación");
      }
      
      return {
        ...profile,
        rfc: decryptText(profile.rfc),
        legalName: decryptText(profile.legalName),
      };
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

      const decryptedProfile = {
        rfc: decryptText(profile.rfc),
        legalName: decryptText(profile.legalName),
        taxRegime: profile.taxRegime,
        cfdiUse: profile.cfdiUse,
        zipCode: profile.zipCode,
      };

      // Verificar orden
      const [order] = await ctx.restaurantDb.select({
        id: orders.id,
        branchId: orders.branchId,
        subtotal: orders.subtotal,
        tax: orders.tax,
        total: orders.total,
        bunzPaid: orders.bunzPaid,
        cfdiStatus: orders.cfdiStatus,
      }).from(orders).where(eq(orders.id, input.orderId));

      if (!order) throw new Error("Orden no encontrada");
      if (order.cfdiStatus === "INVOICED") throw new Error("Esta orden ya fue facturada");

      // Validar monto facturable (Dinero real, no Bunz)
      const bunzPaid = order.bunzPaid || 0;
      const billableAmount = order.total - bunzPaid;
      const taxAmount = order.tax || 0;
      
      if (billableAmount <= 0) {
        throw new Error("El monto facturable debe ser mayor a 0. Las órdenes pagadas al 100% con Bunz no generan CFDI.");
      }

      // Crear registro de factura en la tabla invoices
      const [invoice] = await ctx.restaurantDb.insert(invoices).values({
        branchId: order.branchId || "",
        orderId: order.id,
        billingProfileId: input.billingProfileId,
        rfc: decryptedProfile.rfc,
        legalName: decryptedProfile.legalName,
        taxRegime: decryptedProfile.taxRegime,
        cfdiUse: decryptedProfile.cfdiUse,
        zipCode: decryptedProfile.zipCode,
        billableAmount,
        tax: taxAmount,
        total: billableAmount + taxAmount,
        status: "INVOICED",
        pdfUrl: `https://rabbitty.mx/invoices/${order.id}.pdf`,
      }).returning();

      // Actualizar status en la orden
      await ctx.restaurantDb.update(orders)
        .set({ cfdiStatus: "INVOICED", cfdiUrl: `https://rabbitty.mx/invoices/${order.id}.pdf` })
        .where(eq(orders.id, input.orderId));

      return {
        success: true,
        invoiceId: invoice?.id,
        url: invoice?.pdfUrl,
        billableAmount,
        tax: taxAmount,
        total: billableAmount + taxAmount,
        rfc: decryptedProfile.rfc,
      };
    }),
});
