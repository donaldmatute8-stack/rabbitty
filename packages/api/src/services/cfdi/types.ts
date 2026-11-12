/**
 * ── Contrato de proveedor de timbrado (CFDI multi-tenant) ──────────────────
 *
 * Cada tenant conecta SU cuenta de PAC y paga sus timbres. Rabbitty no timbra
 * con su propio CSD ni revende folios: solo guarda credenciales cifradas y
 * habla con el PAC del tenant.
 *
 * Un `PacProvider` es un adaptador delgado sobre la API del PAC. Todo lo que
 * cambia entre proveedores (rutas, payload, formato de respuesta) se resuelve
 * aquí dentro; el resto del sistema trabaja con estos tipos.
 *
 * Ver: Docs/POS-FASE-0/ADR-021-cfdi.md
 */

export type PacId = "facturama" | "finkok";

export type PacEnvironment = "sandbox" | "production";

/** Credenciales tal como las entrega el tenant. Se guardan cifradas. */
export type PacCredentials = Record<string, string>;

/** Datos fiscales del emisor (los del CSD del tenant). */
export type IssuerData = {
  rfc: string;
  name: string;
  /** c_RegimenFiscal del SAT: 601, 605, 612, 626, … */
  taxRegime: string;
  /** Lugar de expedición (código postal). */
  zipCode: string;
};

/** Receptor de la factura (perfil fiscal del comensal). */
export type ReceiverData = {
  rfc: string;
  name: string;
  /** c_UsoCFDI: G03, G01, I01, CP01, … */
  cfdiUse: string;
  /** c_RegimenFiscalReceptor (obligatorio en CFDI 4.0). */
  taxRegime: string;
  /** Domicilio fiscal del receptor. */
  zipCode: string;
  email?: string | null;
};

export type InvoiceItem = {
  description: string;
  /** ClaveProdServ del SAT (8 dígitos). */
  productCode: string;
  quantity: number;
  unitPrice: number;
  /** ClaveUnidad del SAT: E48 (unidad de servicio), H87 (pieza), … */
  unitCode: string;
  unit?: string;
  /** Tasa de IVA como fracción (0.16). 0 = exento/tasa cero. */
  taxRate?: number;
  /** true cuando el concepto es objeto de impuesto (TaxObject 02). */
  taxed?: boolean;
  discount?: number;
};

export type StampInput = {
  issuer: IssuerData;
  receiver: ReceiverData;
  items: InvoiceItem[];
  currency?: string;
  /** c_FormaPago: 01 efectivo, 03 transferencia, 04 tarjeta de crédito, 28 tarjeta de débito. */
  paymentForm?: string;
  /** PUE | PPD */
  paymentMethod?: "PUE" | "PPD";
  folio?: string;
  serie?: string;
  orderNumber?: string;
  observations?: string;
  /** Fecha de emisión ISO (por defecto ahora). */
  date?: Date;
};

export type StampResult = {
  success: true;
  /** UUID fiscal del timbre. */
  uuid: string;
  /** Id interno del PAC (para cancelar/descargar). */
  pacInvoiceId: string;
  xml: string;
  pdf?: string;
  /** Total timbrado según el PAC (para conciliar). */
  total?: number;
};

export type PacFailure = {
  success: false;
  error: string;
  /** true si el error viene del SAT (p. ej. RFC inválido), false si es de red/auth. */
  fromSat?: boolean;
  details?: unknown;
};

export type CancelInput = {
  pacInvoiceId: string;
  /** UUID fiscal de la factura. */
  uuid: string;
  /** c_MotivoCancelacion: 01, 02, 03, 04. */
  motive: "01" | "02" | "03" | "04";
  /** UUID de la factura que sustituye (obligatorio con motivo 01). */
  replacementUuid?: string;
};

export type CancelResult =
  | { success: true; status: "cancelled" | "pending" }
  | PacFailure;

export type ConnectionTest =
  | { ok: true; message: string; issuer?: Partial<IssuerData> }
  | { ok: false; message: string };

export interface PacProvider {
  readonly id: PacId;
  readonly label: string;

  /** Comprueba credenciales y alcance. Nunca lanza: devuelve el diagnóstico. */
  testConnection(credentials: PacCredentials, environment: PacEnvironment): Promise<ConnectionTest>;

  /** Timbra. Lanza `PacError` solo por fallos inesperados. */
  stamp(
    credentials: PacCredentials,
    environment: PacEnvironment,
    input: StampInput,
  ): Promise<StampResult | PacFailure>;

  cancel(
    credentials: PacCredentials,
    environment: PacEnvironment,
    input: CancelInput,
  ): Promise<CancelResult>;

  /** Descarga XML/PDF de un CFDI ya timbrado. */
  download(
    credentials: PacCredentials,
    environment: PacEnvironment,
    pacInvoiceId: string,
    format: "xml" | "pdf",
  ): Promise<{ success: true; base64: string } | PacFailure>;
}

export class PacError extends Error {
  constructor(
    message: string,
    public readonly provider: PacId,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PacError";
  }
}
