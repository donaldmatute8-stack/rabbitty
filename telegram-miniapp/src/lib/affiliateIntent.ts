"use client";

/**
 * ── Intención de afiliación desde la landing ──
 *
 * La landing manda a `app.rabbitty.me/business?intent=affiliate`. Si el
 * visitante aún no tiene sesión, el login lo manda a /onboarding; guardamos la
 * intención para que, al entrar, aterrice en el alta de negocio (y no en el
 * home de consumidor).
 */

const KEY = "rabbitty_intent_affiliate";

export function captureAffiliateIntent(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    const from = params.get("from");
    if (intent === "affiliate" || from === "landing") {
      window.localStorage.setItem(KEY, "1");
    }
  } catch {
    /* modo privado: seguimos con el flujo normal */
  }
}

export function hasAffiliateIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAffiliateIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nada que limpiar */
  }
}
