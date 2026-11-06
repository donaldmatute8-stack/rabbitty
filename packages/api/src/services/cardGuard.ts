import { TRPCError } from "@trpc/server";

/**
 * ── P0-3: tarjeta nunca se registra sin cargo ─────────────────────────────
 * Un cobro con tarjeta (física o terminal externa) SOLO puede registrarse si
 * existe una referencia/autorización verificable de la terminal. La
 * confirmación del cajero por sí sola no es prueba de cobro.
 */

const CARD_METHODS = new Set(["CREDIT_CARD", "DEBIT_CARD"]);

export function isCardMethod(method: string): boolean {
  return CARD_METHODS.has(String(method).toUpperCase());
}

export function assertCardPaymentAllowed(
  method: string,
  reference?: string | null
): void {
  if (!isCardMethod(method)) return;
  const ref = String(reference ?? "").trim();
  if (ref.length < 3) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "CARD_REQUIRES_TERMINAL_REFERENCE: registra la referencia o autorización de la terminal antes de cobrar con tarjeta.",
    });
  }
}
