/**
 * ── Versiones de los documentos legales (lado servidor) ─────────────────────
 *
 * Debe coincidir con `LEGAL_VERSION` de `telegram-miniapp/src/lib/legal-docs.ts`.
 * Si cambia el texto de cualquier documento, sube esta fecha y el negocio tendrá
 * que **volver a aceptar** antes de seguir operando.
 *
 * `published: false` = documento todavía no vigente para el afiliado
 * (hoy: equipos, porque aún no entregamos lectores ni impresoras).
 */
// ── Una sola versión en todo el sistema ──
// El texto canónico vive en `@rabbitty/legal` (lo renderizan la app y la landing).
// Aquí se re-exporta: al cambiar un documento se sube UNA constante y con eso se
// dispara la re-aceptación del afiliado (este archivo) y del consumidor (app).
export { LEGAL_VERSION } from "@rabbitty/legal";
import { LEGAL_VERSION } from "@rabbitty/legal";

export type BusinessDoc = "TERMS" | "PAYMENTS" | "PRIVACY" | "BUNZ" | "EQUIPMENT";

export const BUSINESS_DOCS: Array<{ doc: BusinessDoc; label: string; published: boolean }> = [
  { doc: "TERMS", label: "Términos y Condiciones de la Plataforma", published: true },
  { doc: "PAYMENTS", label: "Anexo de Pagos (comisiones y liquidaciones)", published: true },
  { doc: "PRIVACY", label: "Aviso de Privacidad", published: true },
  { doc: "BUNZ", label: "Reglamento de la Economía Bunz", published: true },
  // Se activa el día que haya hardware en el local.
  { doc: "EQUIPMENT", label: "Contrato de Comodato de Equipos", published: false },
];

export const REQUIRED_BUSINESS_DOCS = BUSINESS_DOCS.filter((d) => d.published).map((d) => d.doc);
