/**
 * MCCE · Contrato dinámico para el afiliado.
 *
 * El cuerpo del contrato vive en `@rabbitty/legal` (fuente única compartida con
 * /contrato y el re-onboarding). Aquí solo se agrega el bloque de datos de la
 * oferta y se expone el hash para la evidencia.
 *
 * Estado: aprobado operativamente por el fundador el 2026-11-08. No sustituye la
 * revisión legal externa ni la firma electrónica avanzada.
 */

import {
  CONTRACT_STATUS,
  CONTRACT_VERSION,
  renderContractText,
} from "@rabbitty/legal";

export const MCCE_CONTRACT_VERSION = CONTRACT_VERSION;
export const RABBITTY_LEGAL_ENTITY = "MXHUB ECOSISTEMA BLOCKCHAIN, S.A. DE C.V.";
export const RABBITTY_RFC = "MEB2402087Z3";
export const MCCE_CONTRACT_STATUS: "draft" | "approved" = CONTRACT_STATUS;

export type ContractData = {
  rabbittyEntity?: string;
  rabbittyRfc?: string;
  affiliateLegalName?: string;
  affiliateRfc?: string;
  affiliateAddress?: string;
  representative?: string;
  representativePosition?: string;
  businessName?: string;
  niche?: string;
  offerId?: string;
  offerDate?: string;
  capacityTotal?: number;
  promo?: number;
  credit?: number;
  provisioned?: number;
  coverageDays?: number;
  reviewDate?: string;
  recoveryTerms?: string;
  operationalTerms?: string;
  contactEmail?: string;
};

const MISSING = "[POR COMPLETAR]";

export const MCCE_CONTRACT_SUMMARY =
  "Te damos capacidad para recibir a los Rabbitters. No compras Bunz. Una parte es un incentivo de bienvenida y otra es capacidad adelantada que vas recuperando con tu actividad. Lo que ya está comprometido se protege siempre.";

function value(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return MISSING;
  return String(v);
}

export function renderContract(data: ContractData = {}): string {
  const body = renderContractText();
  const dataBlock = [
    "",
    "DATOS DE LA OFERTA",
    `Rabbitty: ${data.rabbittyEntity || RABBITTY_LEGAL_ENTITY} (RFC ${data.rabbittyRfc || RABBITTY_RFC})`,
    `Afiliado: ${value(data.affiliateLegalName)} (RFC ${value(data.affiliateRfc)})`,
    `Domicilio: ${value(data.affiliateAddress)}`,
    `Representante: ${value(data.representative)} (${value(data.representativePosition)})`,
    `Negocio: ${value(data.businessName)}`,
    `Nicho: ${value(data.niche)}`,
    `Oferta: ${value(data.offerId)} · Fecha: ${value(data.offerDate)}`,
    `Capacidad total: ${value(data.capacityTotal)} Bunz`,
    `Incentivo promocional: ${value(data.promo)} Bunz`,
    `Capacidad adelantada: ${value(data.credit)} Bunz`,
    `Capacidad provisionada: ${value(data.provisioned)} Bunz`,
    `Cobertura: ${value(data.coverageDays)} días`,
    `Revisión: ${value(data.reviewDate)}`,
    `Recuperación: ${value(data.recoveryTerms)}`,
    `Condiciones operativas: ${value(data.operationalTerms)}`,
    `Contacto: ${value(data.contactEmail)}`,
    "",
    "Los datos de la oferta se completan en el alta. La capacidad es una propuesta y no se activa hasta que el afiliado la acepte expresamente.",
  ].join("\n");
  return `${body}${dataBlock}`;
}

/** Hash estable del contrato renderizado para evidencia. */
export async function hashContract(text: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fallback */
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}
