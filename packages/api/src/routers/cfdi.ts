import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { billingProfiles } from "@rabbitty/database-core/schema";
import { invoices, orders } from "@rabbitty/database-restaurant";
import { protectedProcedure, router } from "../trpc";
import { decryptText } from "../services/crypto";
import { resolveBusinessIdFromBranch } from "../services/businessContext";
import {
  PAC_PROVIDERS,
  cancelInvoice,
  downloadInvoiceFile,
  getConnectionSummary,
  getPacProvider,
  issueInvoiceForOrder,
  loadActiveCredentials,
  savePacCredentials,
  CfdiError,
} from "../services/cfdi";

/**
 * ── CFDI multi-tenant (ADR-021) ────────────────────────────────────────────
 *
 * El tenant conecta su PAC desde aquí y paga sus timbres. Estos procedimientos
 * solo orquestan: nunca timbran con credenciales de Rabbitty.
 */

/** Proveedores con adaptador implementado. */
const providerIds = ["facturama"] as const;

const issuerSchema = z.object({
  rfc: z.string().min(12).max(13),
  name: z.string().min(1),
  taxRegime: z.string().min(3),
  zipCode: z.string().length(5),
});

/** Solo dueño o encargado puede tocar la facturación del negocio. */
function assertAdmin(ctx: any) {
  if (ctx.staffRole && !["ADMIN", "MANAGER"].includes(ctx.staffRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo el encargado puede configurar la facturación" });
  }
}

async function businessIdOf(ctx: any): Promise<string> {
  const businessId = await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId);
  if (!businessId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "La sucursal no tiene negocio asociado" });
  }
  return businessId;
}

function toTrpc(error: unknown): never {
  if (error instanceof CfdiError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const cfdiRouter = router({
  /** Catálogo de proveedores soportados (para el selector del admin). */
  providers: protectedProcedure.query(() =>
    Object.values(PAC_PROVIDERS).map((p) => ({ id: p.id, label: p.label })),
  ),

  /** Conexiones configuradas del negocio (sin secretos). */
  getConnection: protectedProcedure
    .input(z.object({ environment: z.enum(["sandbox", "production"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const businessId = await businessIdOf(ctx);
      const rows = await getConnectionSummary(ctx.restaurantDb, businessId);
      return {
        businessId,
        connections: rows,
        active:
          rows.find((r: any) => r.isActive && r.environment === (input?.environment ?? "sandbox")) ??
          rows.find((r: any) => r.isActive) ??
          null,
      };
    }),

  /** Prueba credenciales. Sin `credentials` usa las ya guardadas. */
  testConnection: protectedProcedure
    .input(
      z.object({
        provider: z.enum(providerIds),
        environment: z.enum(["sandbox", "production"]),
        credentials: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const businessId = await businessIdOf(ctx);

      let credentials = input.credentials;
      let environment = input.environment;
      if (!credentials) {
        const stored = await loadActiveCredentials(ctx.restaurantDb, businessId, environment);
        if (!stored) {
          return { ok: false, message: "No hay credenciales guardadas para probar" };
        }
        credentials = stored.credentials;
        environment = stored.environment;
      }

      const provider = getPacProvider(input.provider);
      return provider.testConnection(credentials, environment);
    }),

  /**
   * Guarda las credenciales del PAC del tenant. Se prueba primero y, pase o no,
   * queda registrado el resultado (así el admin muestra el diagnóstico).
   */
  saveConnection: protectedProcedure
    .input(
      z.object({
        provider: z.enum(providerIds),
        environment: z.enum(["sandbox", "production"]),
        issuer: issuerSchema,
        credentials: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const businessId = await businessIdOf(ctx);

      const provider = getPacProvider(input.provider);
      const test = await provider.testConnection(input.credentials, input.environment);

      await savePacCredentials(ctx.restaurantDb, {
        businessId,
        provider: input.provider,
        environment: input.environment,
        issuer: input.issuer,
        credentials: input.credentials,
        test,
      });

      return { ok: test.ok, message: test.message };
    }),

  /**
   * Timbra una orden con el PAC del tenant. El receptor puede venir de un
   * perfil guardado o capturarse a mano (cliente de mostrador).
   */
  issueOrder: protectedProcedure
    .input(
      z
        .object({
          orderId: z.string(),
          billingProfileId: z.string().optional(),
          receiver: z
            .object({
              rfc: z.string().min(12).max(13),
              name: z.string().min(1),
              taxRegime: z.string().min(3),
              cfdiUse: z.string().min(2),
              zipCode: z.string().length(5),
              email: z.string().email().optional().or(z.literal("")),
            })
            .optional(),
          environment: z.enum(["sandbox", "production"]).optional(),
          paymentForm: z.string().optional(),
          serie: z.string().max(25).optional(),
        })
        .refine((v) => Boolean(v.billingProfileId || v.receiver), {
          message: "Indica un perfil de facturación o los datos del receptor",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      const businessId = await businessIdOf(ctx);

      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId, cfdiStatus: orders.cfdiStatus })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });

      let receiver;
      if (input.billingProfileId) {
        const [profile] = await ctx.coreDb
          .select()
          .from(billingProfiles)
          .where(eq(billingProfiles.id, input.billingProfileId))
          .limit(1);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de facturación no encontrado" });
        receiver = {
          rfc: decryptText(profile.rfc),
          name: decryptText(profile.legalName),
          cfdiUse: profile.cfdiUse,
          taxRegime: profile.taxRegime,
          zipCode: profile.zipCode,
          email: profile.email,
        };
      } else {
        receiver = {
          rfc: input.receiver!.rfc.toUpperCase(),
          name: input.receiver!.name,
          cfdiUse: input.receiver!.cfdiUse,
          taxRegime: input.receiver!.taxRegime,
          zipCode: input.receiver!.zipCode,
          email: input.receiver!.email || null,
        };
      }

      try {
        return await issueInvoiceForOrder({
          db: ctx.restaurantDb,
          orderId: order.id,
          businessId,
          billingProfileId: input.billingProfileId ?? null,
          environment: input.environment,
          paymentForm: input.paymentForm,
          serie: input.serie,
          receiver,
          actor: {
            staffId: ctx.posOperator?.staffId ?? null,
            terminalId: ctx.posAuth?.terminalId ?? null,
          },
        });
      } catch (error) {
        toTrpc(error);
      }
    }),

  /** Cancela una factura: primero el PAC, después la base. */
  cancel: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        motive: z.enum(["01", "02", "03", "04"]),
        replacementUuid: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);

      const [invoice] = await ctx.restaurantDb
        .select({ id: invoices.id, branchId: invoices.branchId })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.branchId, ctx.branchId)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Factura no encontrada" });

      try {
        return await cancelInvoice({
          db: ctx.restaurantDb,
          invoiceId: invoice.id,
          motive: input.motive,
          replacementUuid: input.replacementUuid,
          actor: {
            staffId: ctx.posOperator?.staffId ?? null,
            terminalId: ctx.posAuth?.terminalId ?? null,
          },
        });
      } catch (error) {
        toTrpc(error);
      }
    }),

  /** XML/PDF en base64 (el cliente arma el archivo). */
  download: protectedProcedure
    .input(z.object({ invoiceId: z.string(), format: z.enum(["xml", "pdf"]) }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await ctx.restaurantDb
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.branchId, ctx.branchId)))
        .limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Factura no encontrada" });

      try {
        return await downloadInvoiceFile({
          db: ctx.restaurantDb,
          invoiceId: invoice.id,
          format: input.format,
        });
      } catch (error) {
        toTrpc(error);
      }
    }),
});
