/**
 * ── Facturama: implementación de `PacProvider` ─────────────────────────────
 *
 * Autenticación HTTP Basic con las credenciales de la cuenta **del tenant**.
 * Sandbox y producción comparten rutas; solo cambia el host, así que un mismo
 * par de credenciales de sandbox no sirve en producción (y al revés).
 *
 * Rutas usadas (API Web de Facturama, CFDI 4.0):
 *   POST   /3/cfdis                → timbrar
 *   GET    /3/cfdis?page=1         → probar credenciales
 *   DELETE /3/cfdis/{id}?motive=…  → cancelar
 *   GET    /cfdi/{id}/{format}     → XML/PDF en base64
 *
 * Nota: Facturama no es PAC, timbra a través de PAC autorizados; el tenant
 * contrata su cuenta y paga sus timbres.
 */

import {
  type CancelInput,
  type CancelResult,
  type ConnectionTest,
  type PacCredentials,
  type PacEnvironment,
  type PacFailure,
  type PacProvider,
  type StampInput,
  type StampResult,
  PacError,
} from "./types";

const HOSTS: Record<PacEnvironment, string> = {
  sandbox: "https://apisandbox.facturama.mx",
  production: "https://api.facturama.mx",
};

type FacturamaCfdiResponse = {
  Id?: string;
  Status?: string;
  Total?: number;
  Complement?: { TaxStamp?: { Uuid?: string } };
};

function authHeader(credentials: PacCredentials): string {
  const user = credentials.username ?? "";
  const password = credentials.password ?? "";
  if (!user || !password) {
    throw new PacError("Faltan usuario y contraseña de Facturama", "facturama");
  }
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

/** Mensaje legible a partir del error de Facturama. */
function extractError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, any>;
    if (typeof b.Message === "string" && b.Message.trim()) return b.Message;
    if (typeof b.message === "string" && b.message.trim()) return b.message;
    if (b.ModelState) {
      const first = Object.values(b.ModelState)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    if (typeof b.Description === "string") return b.Description;
  }
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  return `Facturama respondió ${status}`;
}

async function call(
  credentials: PacCredentials,
  environment: PacEnvironment,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${HOSTS[environment]}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: authHeader(credentials),
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      // El timbrado puede tardar; el PAC no debe colgar una request del POS.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new PacError(
      `No se pudo contactar a Facturama (${environment}): ${(error as Error).message}`,
      "facturama",
      error,
    );
  }

  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      /* respuesta no JSON (HTML de error) */
    }
  }
  return { status: res.status, body };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Fecha local de México en el formato que espera Facturama. */
function localDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T");
}

export function buildFacturamaPayload(input: StampInput): Record<string, unknown> {
  const items = input.items.map((item) => {
    const subtotal = round2(item.quantity * item.unitPrice);
    const discount = round2(item.discount ?? 0);
    const base = round2(subtotal - discount);
    const taxed = item.taxed !== false;
    const rate = item.taxRate ?? 0.16;
    const taxTotal = taxed ? round2(base * rate) : 0;

    return {
      ProductCode: item.productCode,
      IdentificationNumber: item.productCode,
      Description: item.description,
      Unit: item.unit ?? "Unidad",
      UnitCode: item.unitCode,
      UnitPrice: round2(item.unitPrice),
      Quantity: item.quantity,
      Subtotal: subtotal,
      ...(discount > 0 ? { Discount: discount } : {}),
      TaxObject: taxed ? "02" : "01",
      ...(taxed
        ? {
            Taxes: [
              {
                Total: taxTotal,
                Name: "IVA",
                Base: base,
                Rate: rate,
                IsRetention: false,
              },
            ],
          }
        : {}),
      Total: round2(base + taxTotal),
    };
  });

  return {
    NameId: "1",
    Currency: input.currency ?? "MXN",
    CfdiType: "I",
    Folio: input.folio,
    Serie: input.serie,
    PaymentForm: input.paymentForm ?? "01",
    PaymentMethod: input.paymentMethod ?? "PUE",
    ExpeditionPlace: input.issuer.zipCode,
    Date: localDate(input.date),
    ...(input.orderNumber ? { OrderNumber: input.orderNumber } : {}),
    ...(input.observations ? { Observations: input.observations } : {}),
    Receiver: {
      Rfc: input.receiver.rfc,
      Name: input.receiver.name,
      CfdiUse: input.receiver.cfdiUse,
      FiscalRegime: input.receiver.taxRegime,
      TaxZipCode: input.receiver.zipCode,
      ...(input.receiver.email ? { Email: input.receiver.email } : {}),
    },
    Items: items,
  };
}

export const facturamaProvider: PacProvider = {
  id: "facturama",
  label: "Facturama",

  async testConnection(credentials, environment): Promise<ConnectionTest> {
    try {
      const { status, body } = await call(credentials, environment, "/3/cfdis?page=1", { method: "GET" });
      if (status === 401 || status === 403) {
        return { ok: false, message: "Credenciales rechazadas por Facturama" };
      }
      if (status >= 200 && status < 300) {
        return { ok: true, message: `Conectado a Facturama (${environment})` };
      }
      return { ok: false, message: extractError(body, status) };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  },

  async stamp(credentials, environment, input): Promise<StampResult | PacFailure> {
    const payload = buildFacturamaPayload(input);

    let response;
    try {
      response = await call(credentials, environment, "/3/cfdis", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }

    const { status, body } = response;
    if (status < 200 || status >= 300) {
      return {
        success: false,
        error: extractError(body, status),
        fromSat: status === 400 || status === 422,
        details: body,
      };
    }

    const cfdi = body as FacturamaCfdiResponse;
    const uuid = cfdi?.Complement?.TaxStamp?.Uuid;
    if (!cfdi?.Id || !uuid) {
      return {
        success: false,
        error: "Facturama aceptó la petición pero no devolvió UUID",
        details: body,
      };
    }

    return {
      success: true,
      uuid,
      pacInvoiceId: cfdi.Id,
      // El XML/PDF se descargan aparte para no inflar la respuesta del POS.
      xml: "",
      total: cfdi.Total,
    };
  },

  async cancel(credentials, environment, input: CancelInput): Promise<CancelResult> {
    const params = new URLSearchParams({ motive: input.motive });
    if (input.replacementUuid) params.set("uuidReplacement", input.replacementUuid);

    let response;
    try {
      response = await call(
        credentials,
        environment,
        `/3/cfdis/${encodeURIComponent(input.pacInvoiceId)}?${params.toString()}`,
        { method: "DELETE" },
      );
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }

    const { status, body } = response;
    if (status >= 200 && status < 300) {
      const data = body as { Status?: string } | undefined;
      return { success: true, status: data?.Status === "cancelled" ? "cancelled" : "pending" };
    }
    return { success: false, error: extractError(body, status), details: body };
  },

  async download(credentials, environment, pacInvoiceId, format) {
    let response;
    try {
      response = await call(
        credentials,
        environment,
        `/cfdi/${encodeURIComponent(pacInvoiceId)}/${format}`,
        { method: "GET" },
      );
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }

    const { status, body } = response;
    if (status < 200 || status >= 300) {
      return { success: false, error: extractError(body, status), details: body };
    }
    if (typeof body !== "string") {
      return { success: false, error: "Facturama no devolvió el archivo" };
    }
    // La respuesta llega como string base64 entre comillas.
    return { success: true, base64: body.replace(/^"|"$/g, "") };
  },
};
