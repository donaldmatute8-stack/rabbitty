import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { orders, invoices, branches } from "@rabbitty/database-restaurant";
import { billingProfiles } from "@rabbitty/database-core/schema";
import { withOrderMutation } from "../services/orderIntegrity";
import { encryptText, decryptText } from "../services/crypto";
import { resolveBusinessIdFromBranch } from "../services/businessContext";
import { issueInvoiceForOrder } from "../services/cfdi";

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

  /**
   * Solicita la factura de una orden. El timbrado lo hace el PAC **del
   * negocio** (ADR-021): si el negocio no conectó su PAC, se rechaza con un
   * mensaje claro en vez de simular una factura.
   */
  requestInvoice: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      billingProfileId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar perfil
      const [profile] = await ctx.coreDb.select().from(billingProfiles).where(eq(billingProfiles.id, input.billingProfileId));
      if (!profile) throw new Error("Perfil de facturación no encontrado");

      const receiver = {
        rfc: decryptText(profile.rfc),
        legalName: decryptText(profile.legalName),
        taxRegime: profile.taxRegime,
        cfdiUse: profile.cfdiUse,
        zipCode: profile.zipCode,
        email: profile.email,
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

      // Solo hay factura si hubo dinero real (los Bunz no generan CFDI).
      const billableAmount = order.total - (order.bunzPaid || 0);
      if (billableAmount <= 0) {
        throw new Error("La orden se pagó al 100% con Bunz; no genera CFDI.");
      }

      const businessId = await resolveBusinessIdFromBranch(ctx.restaurantDb, order.branchId);
      if (!businessId) throw new Error("La sucursal no tiene negocio asociado");

      const result = await issueInvoiceForOrder({
        db: ctx.restaurantDb,
        orderId: order.id,
        businessId,
        billingProfileId: profile.id,
        receiver: {
          rfc: receiver.rfc,
          name: receiver.legalName,
          taxRegime: receiver.taxRegime,
          cfdiUse: receiver.cfdiUse,
          zipCode: receiver.zipCode,
          email: receiver.email,
        },
        actor: { staffId: null, terminalId: null },
      });

      if (!result.success) throw new Error(result.error);

      return {
        success: true,
        invoiceId: result.invoiceId,
        uuid: result.uuid,
        // La descarga se pide a `cfdi.download`; no hay URL pública aún.
        url: null,
        billableAmount,
        tax: order.tax,
        total: result.total,
        rfc: receiver.rfc,
      };
    }),
});
