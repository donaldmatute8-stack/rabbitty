import { createHash, randomUUID } from "node:crypto";
import { CONTRACT_STATUS, CONTRACT_VERSION, renderContractText } from "./contractContent";

/**
 * Evidencia canónica de aceptación.
 *
 * El hash se calcula sobre un texto determinista que incluye:
 *   - el contrato completo (fuente compartida con /contrato),
 *   - el Anexo B operativo,
 *   - un bloque de datos de la aceptación.
 *
 * No se hashea un JSON de conveniencia: se hashea el texto que se puede
 * reconstruir y entregar al afiliado.
 */

export type AcceptanceInput = {
  contractVersion?: string;
  acceptanceId?: string;
  offerId: string;
  businessName: string;
  legalName: string;
  rfc: string;
  representative: string;
  representativePosition?: string | null;
  address: string;
  email: string;
  phone: string;
  capacity: number;
  promo: number;
  credit: number;
  coverageMonths: number;
  acceptedAt: string;
  signedBy: string;
  signatureMethod: "name_checkbox";
  acceptedIp?: string | null;
  acceptedUserAgent?: string | null;
  reonboardingTokenId?: string | null;
};

export type AcceptanceEvidence = {
  acceptanceId: string;
  offerId: string;
  contractVersion: string;
  hashVersion: "canonical-v1";
  contractText: string;
  annexBText: string;
  text: string;
  contractTextHash: string;
  annexBHash: string;
  textHash: string;
  contractHash: string;
};

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export function buildAnnexBText(input: AcceptanceInput): string {
  return [
    "ANEXO B · CONDICIONES OPERATIVAS Y DE REDENCIÓN",
    `Afiliado: ${input.legalName} (${input.rfc})`,
    `Negocio: ${input.businessName}`,
    `Domicilio: ${input.address}`,
    `Contacto: ${input.email} · ${input.phone}`,
    "",
    "1. La redención es válida cuando los sistemas de RABBITTY la confirman.",
    "2. El AFILIADO verificará la confirmación antes de entregar el producto o servicio.",
    "3. La redención confirmada consume la capacidad y los Bunz del Rabbitter.",
    "4. No se exigirá otro método de pago ni se modificará el precio confirmado.",
    "5. Los Bunz no son dinero, no son convertibles a efectivo y no generan rendimientos.",
    "6. Las condiciones, límites y exclusiones se informan antes de la redención.",
    "7. Devoluciones, cancelaciones y disputas se documentan sin eliminar el movimiento original.",
    "8. Cualquier cambio a este Anexo requiere nueva versión y aceptación.",
    "",
    `Capacidad propuesta: ${money(input.capacity)} Bunz`,
    `Incentivo promocional: ${money(input.promo)} Bunz`,
    `Capacidad adelantada: ${money(input.credit)} Bunz`,
    `Cobertura: ${input.coverageMonths} meses`,
    "",
    "Este anexo es un borrador operativo y no activa capacidad real por sí mismo.",
  ].join("\n");
}

export function buildAcceptanceEvidence(input: AcceptanceInput): AcceptanceEvidence {
  const acceptanceId = input.acceptanceId || randomUUID();
  const contractVersion = input.contractVersion || CONTRACT_VERSION;
  const contractText = renderContractText(contractVersion);
  const annexBText = buildAnnexBText({ ...input, acceptanceId });

  const acceptanceBlock = [
    "DATOS DE LA ACEPTACIÓN",
    `acceptanceId: ${acceptanceId}`,
    `offerId: ${input.offerId}`,
    `contractVersion: ${contractVersion}`,
    `contractStatus: ${CONTRACT_STATUS}`,
    `businessName: ${input.businessName}`,
    `legalName: ${input.legalName}`,
    `rfc: ${input.rfc}`,
    `representative: ${input.representative}`,
    `representativePosition: ${input.representativePosition || ""}`,
    `address: ${input.address}`,
    `email: ${input.email}`,
    `phone: ${input.phone}`,
    `capacity: ${input.capacity}`,
    `promo: ${input.promo}`,
    `credit: ${input.credit}`,
    `coverageMonths: ${input.coverageMonths}`,
    `acceptedAt: ${input.acceptedAt}`,
    `signedBy: ${input.signedBy}`,
    `signatureMethod: ${input.signatureMethod}`,
    `acceptedIp: ${input.acceptedIp || ""}`,
    `acceptedUserAgent: ${input.acceptedUserAgent || ""}`,
    `reonboardingTokenId: ${input.reonboardingTokenId || ""}`,
  ].join("\n");

  const text = [contractText, annexBText, acceptanceBlock].join("\n\n---\n\n");
  const contractTextHash = sha256Hex(contractText);
  const annexBHash = sha256Hex(annexBText);
  const textHash = sha256Hex(text);
  const contractHash = sha256Hex(
    [
      "RABBITTY-CONTRACT",
      `version=${contractVersion}`,
      `acceptanceId=${acceptanceId}`,
      `offerId=${input.offerId}`,
      `text-sha256=${textHash}`,
      `contract-sha256=${contractTextHash}`,
      `annex-b-sha256=${annexBHash}`,
      `acceptedBy=${input.legalName}`,
      `representative=${input.representative}`,
      `acceptedAt=${input.acceptedAt}`,
    ].join("\n")
  );

  return {
    acceptanceId,
    offerId: input.offerId,
    contractVersion,
    hashVersion: "canonical-v1",
    contractText,
    annexBText,
    text,
    contractTextHash,
    annexBHash,
    textHash,
    contractHash,
  };
}
