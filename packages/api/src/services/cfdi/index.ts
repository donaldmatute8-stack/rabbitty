/**
 * ── Capa CFDI: credenciales del tenant + timbrado ──────────────────────────
 *
 * Regla de negocio: **cada tenant paga sus timbres**. Rabbitty no timbra con
 * su CSD ni revende folios; solo guarda (cifradas) las credenciales del PAC del
 * tenant y habla con su API.
 *
 * Flujo:
 *   1. `savePacCredentials`  → prueba contra el PAC y guarda cifrado.
 *   2. `issueInvoiceForOrder` → timbra y deja rastro en `invoices`.
 *   3. `cancelInvoice`        → cancela en el PAC y en la base.
 *
 * Si no hay credenciales activas, se falla con `CfdiNotConfiguredError` y NO
 * se marca la orden como facturada (la promesa comercial se retira hasta que
 * el tenant conecte su PAC).
 */

import { and, eq } from "drizzle-orm";
import { cfdiCredentials, invoices, menuItems, orderItems, orders } from "@rabbitty/database-restaurant";
import { encryptText, decryptText } from "../crypto";
import { calcTax, withOrderMutation } from "../orderIntegrity";
import { facturamaProvider } from "./facturama";
import type {
  PacCredentials,
  PacEnvironment,
  PacId,
  PacProvider,
  ReceiverData,
  StampInput,
} from "./types";

export const PAC_PROVIDERS: Record<string, PacProvider> = {
  facturama: facturamaProvider,
};

export function getPacProvider(id: string): PacProvider {
  const provider = PAC_PROVIDERS[id as PacId];
  if (!provider) throw new CfdiError(`Proveedor de timbrado desconocido: ${id}`);
  return provider;
}

export class CfdiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CfdiError";
  }
}

export class CfdiNotConfiguredError extends CfdiError {
  constructor() {
    super(
      "La facturación todavía no está habilitada para este negocio: conecta tu cuenta de PAC en Configuración → Facturación.",
    );
    this.name = "CfdiNotConfiguredError";
  }
}

/** Clave de producto/servicio del SAT para alimentos preparados. */
const PRODUCT_CODE_FOOD = "90101500";
const UNIT_CODE_SERVICE = "E48";

type StoredCredentials = {
  id: string;
  provider: PacId;
  environment: PacEnvironment;
  issuer: { rfc: string; name: string; taxRegime: string; zipCode: string };
  credentials: PacCredentials;
};

/** Devuelve las credenciales activas del negocio (cifradas → en claro). */
export async function loadActiveCredentials(
  db: any,
  businessId: string,
  environment?: PacEnvironment,
): Promise<StoredCredentials | null> {
  const rows = await db
    .select()
    .from(cfdiCredentials)
    .where(and(eq(cfdiCredentials.businessId, businessId), eq(cfdiCredentials.isActive, true)));

  const row =
    (environment && rows.find((r: any) => r.environment === environment)) || rows[0] || null;
  if (!row) return null;

  let credentials: PacCredentials = {};
  try {
    credentials = JSON.parse(decryptText(row.credentials) || "{}");
  } catch {
    throw new CfdiError("Las credenciales del PAC no se pudieron descifrar");
  }

  return {
    id: row.id,
    provider: row.provider as PacId,
    environment: row.environment as PacEnvironment,
    issuer: {
      rfc: row.issuerRfc,
      name: row.issuerName,
      taxRegime: row.issuerTaxRegime,
      zipCode: row.issuerZipCode,
    },
    credentials,
  };
}

/** Guarda (upsert) las credenciales del PAC. El llamador ya validó el alcance. */
export async function savePacCredentials(
  db: any,
  input: {
    businessId: string;
    provider: PacId;
    environment: PacEnvironment;
    issuer: StoredCredentials["issuer"];
    credentials: PacCredentials;
    test: { ok: boolean; message: string };
  },
) {
  const values = {
    businessId: input.businessId,
    provider: input.provider,
    environment: input.environment,
    issuerRfc: input.issuer.rfc,
    issuerName: input.issuer.name,
    issuerTaxRegime: input.issuer.taxRegime,
    issuerZipCode: input.issuer.zipCode,
    credentials: encryptText(JSON.stringify(input.credentials)),
    isActive: true,
    lastTestedAt: new Date(),
    lastTestStatus: input.test.ok ? "OK" : "FAILED",
    lastTestMessage: input.test.message,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(cfdiCredentials)
    .values(values)
    .onConflictDoUpdate({
      target: [cfdiCredentials.businessId, cfdiCredentials.provider, cfdiCredentials.environment],
      set: {
        issuerRfc: values.issuerRfc,
        issuerName: values.issuerName,
        issuerTaxRegime: values.issuerTaxRegime,
        issuerZipCode: values.issuerZipCode,
        credentials: values.credentials,
        isActive: true,
        lastTestedAt: values.lastTestedAt,
        lastTestStatus: values.lastTestStatus,
        lastTestMessage: values.lastTestMessage,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return row;
}

/** Datos públicos de la conexión (nunca devuelve el secreto). */
export async function getConnectionSummary(db: any, businessId: string) {
  const rows = await db
    .select({
      id: cfdiCredentials.id,
      provider: cfdiCredentials.provider,
      environment: cfdiCredentials.environment,
      issuerRfc: cfdiCredentials.issuerRfc,
      issuerName: cfdiCredentials.issuerName,
      issuerTaxRegime: cfdiCredentials.issuerTaxRegime,
      issuerZipCode: cfdiCredentials.issuerZipCode,
      isActive: cfdiCredentials.isActive,
      lastTestedAt: cfdiCredentials.lastTestedAt,
      lastTestStatus: cfdiCredentials.lastTestStatus,
      lastTestMessage: cfdiCredentials.lastTestMessage,
    })
    .from(cfdiCredentials)
    .where(eq(cfdiCredentials.businessId, businessId));

  return rows;
}

/**
 * Construye los conceptos del CFDI a partir de los ítems vivos de la orden.
 * Los precios del POS son **con IVA incluido**, así que se desglosan.
 */
export async function buildItemsFromOrder(db: any, orderId: string) {
  const rows = await db
    .select({
      quantity: orderItems.quantity,
      totalPrice: orderItems.totalPrice,
      notes: orderItems.notes,
      voidedAt: orderItems.voidedAt,
      name: menuItems.name,
    })
    .from(orderItems)
    .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
    .where(eq(orderItems.orderId, orderId));

  const alive = rows.filter((r: any) => !r.voidedAt);
  if (alive.length === 0) return [];

  return alive.map((row: any) => {
    const quantity = Number(row.quantity) || 1;
    const gross = Number(row.totalPrice) || 0;
    const { subtotal } = calcTax(gross);
    return {
      description: row.name || row.notes || "Consumo",
      productCode: PRODUCT_CODE_FOOD,
      quantity,
      unitPrice: subtotal / quantity,
      unitCode: UNIT_CODE_SERVICE,
      unit: "Unidad de servicio",
      taxRate: 0.16,
      taxed: true,
    };
  });
}

/**
 * Timbra una orden. Escribe la factura SOLO si el PAC confirma.
 *
 * Decisión fiscal: el CFDI cubre la venta completa (los Bunz son una forma de
 * pago, no un descuento). Si el negocio necesitara facturar solo la parte en
 * dinero, se ajusta aquí con una regla explícita.
 */
export async function issueInvoiceForOrder(params: {
  db: any;
  orderId: string;
  businessId: string;
  receiver: ReceiverData;
  billingProfileId?: string | null;
  environment?: PacEnvironment;
  paymentForm?: string;
  serie?: string;
  actor?: { staffId?: string | null; terminalId?: string | null };
}): Promise<
  | { success: true; invoiceId: string; uuid: string; pacInvoiceId: string; total: number }
  | { success: false; invoiceId?: string; error: string }
> {
  const { db, orderId, businessId } = params;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new CfdiError("Orden no encontrada");
  if (String(order.cfdiStatus) === "INVOICED") throw new CfdiError("Esta orden ya fue facturada");

  const connection = await loadActiveCredentials(db, businessId, params.environment);
  if (!connection) throw new CfdiNotConfiguredError();

  const items = await buildItemsFromOrder(db, orderId);
  if (items.length === 0) throw new CfdiError("La orden no tiene conceptos facturables");

  const provider = getPacProvider(connection.provider);
  const input: StampInput = {
    issuer: connection.issuer,
    receiver: params.receiver,
    items,
    paymentForm: params.paymentForm ?? "01",
    paymentMethod: "PUE",
    orderNumber: orderId,
    folio: String(orderId).replace(/-/g, "").slice(-10),
    serie: params.serie,
    observations: order.notes ?? undefined,
  };

  const result = await provider.stamp(connection.credentials, connection.environment, input);

  if (!result.success) {
    // Rastro del intento fallido: sirve para soporte y para reintentar.
    const [failed] = await db
      .insert(invoices)
      .values({
        branchId: order.branchId,
        orderId: order.id,
        billingProfileId: params.billingProfileId ?? "",
        businessId,
        provider: connection.provider,
        environment: connection.environment,
        rfc: params.receiver.rfc,
        legalName: params.receiver.name,
        taxRegime: params.receiver.taxRegime,
        cfdiUse: params.receiver.cfdiUse,
        zipCode: params.receiver.zipCode,
        billableAmount: Number(order.subtotal),
        tax: Number(order.tax),
        total: Number(order.total),
        status: "FAILED",
        errorMessage: result.error,
      })
      .returning();

    return { success: false, invoiceId: failed?.id, error: result.error };
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      branchId: order.branchId,
      orderId: order.id,
      billingProfileId: params.billingProfileId ?? "",
      businessId,
      provider: connection.provider,
      environment: connection.environment,
      rfc: params.receiver.rfc,
      legalName: params.receiver.name,
      taxRegime: params.receiver.taxRegime,
      cfdiUse: params.receiver.cfdiUse,
      zipCode: params.receiver.zipCode,
      billableAmount: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      status: "INVOICED",
      uuid: result.uuid,
      pacInvoiceId: result.pacInvoiceId,
      issuedAt: new Date(),
    })
    .returning();

  await db.transaction(async (tx: any) => {
    await withOrderMutation(
      tx,
      {
        orderId,
        type: "CFDI_REGISTERED",
        actor: params.actor ?? { staffId: null, terminalId: null },
      },
      async (_o: any, _c: any) => {
        await tx
          .update(orders)
          // Sin URL pública todavía: el XML/PDF se descarga por el router
          // (`cfdi.download`). Un enlace inventado sería otra promesa falsa.
          .set({ cfdiStatus: "INVOICED", cfdiUrl: null })
          .where(eq(orders.id, orderId));
      },
    );
  });

  return {
    success: true,
    invoiceId: invoice.id,
    uuid: result.uuid,
    pacInvoiceId: result.pacInvoiceId,
    total: result.total ?? Number(order.total),
  };
}

/** Cancela una factura ya timbrada. Primero el PAC, luego la base. */
export async function cancelInvoice(params: {
  db: any;
  invoiceId: string;
  motive: "01" | "02" | "03" | "04";
  replacementUuid?: string;
  actor?: { staffId?: string | null; terminalId?: string | null };
}): Promise<{ success: boolean; status?: string; error?: string }> {
  const { db, invoiceId } = params;

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new CfdiError("Factura no encontrada");
  if (invoice.status === "CANCELLED") throw new CfdiError("Esta factura ya está cancelada");

  // Sin PAC o sin timbre: cancelación local (comprobante que nunca existió en SAT).
  if (!invoice.pacInvoiceId || !invoice.provider) {
    await db
      .update(invoices)
      .set({ status: "CANCELLED", cancelledAt: new Date(), cancellationMotive: params.motive })
      .where(eq(invoices.id, invoiceId));
    return { success: true, status: "cancelled" };
  }

  const connection = await loadActiveCredentials(db, invoice.businessId ?? "", invoice.environment as PacEnvironment);
  if (!connection) throw new CfdiNotConfiguredError();

  const provider = getPacProvider(invoice.provider);
  const result = await provider.cancel(connection.credentials, connection.environment, {
    pacInvoiceId: invoice.pacInvoiceId,
    uuid: invoice.uuid ?? "",
    motive: params.motive,
    replacementUuid: params.replacementUuid,
  });

  if (!result.success) return { success: false, error: result.error };

  await db
    .update(invoices)
    .set({
      status: result.status === "cancelled" ? "CANCELLED" : "CANCELLATION_PENDING",
      cancelledAt: result.status === "cancelled" ? new Date() : null,
      cancellationMotive: params.motive,
      replacementUuid: params.replacementUuid ?? null,
    })
    .where(eq(invoices.id, invoiceId));

  if (result.status === "cancelled") {
    await db.transaction(async (tx: any) => {
      await withOrderMutation(
        tx,
        {
          orderId: invoice.orderId,
          type: "CFDI_CANCELLED",
          actor: params.actor ?? { staffId: null, terminalId: null },
        },
        async (_o: any, _c: any) => {
          await tx
            .update(orders)
            .set({ cfdiStatus: "NONE", cfdiUrl: null })
            .where(eq(orders.id, invoice.orderId));
        },
      );
    });
  }

  return { success: true, status: result.status };
}

/** Descarga XML/PDF del PAC. */
export async function downloadInvoiceFile(params: {
  db: any;
  invoiceId: string;
  format: "xml" | "pdf";
}): Promise<{ success: true; base64: string; filename: string } | { success: false; error: string }> {
  const [invoice] = await params.db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.invoiceId))
    .limit(1);
  if (!invoice) throw new CfdiError("Factura no encontrada");
  if (!invoice.pacInvoiceId || !invoice.provider) {
    return { success: false, error: "Esta factura no tiene timbre del PAC" };
  }

  const connection = await loadActiveCredentials(
    params.db,
    invoice.businessId ?? "",
    invoice.environment as PacEnvironment,
  );
  if (!connection) throw new CfdiNotConfiguredError();

  const provider = getPacProvider(invoice.provider);
  const result = await provider.download(
    connection.credentials,
    connection.environment,
    invoice.pacInvoiceId,
    params.format,
  );
  if (!result.success) return { success: false, error: result.error };

  const safeRfc = (invoice.rfc || "cfdi").replace(/[^A-Z0-9]/gi, "");
  return {
    success: true,
    base64: result.base64,
    filename: `${safeRfc}-${invoice.uuid ?? invoice.id}.${params.format}`,
  };
}
