/**
 * ── Ofertas reales (Stock) ─────────────────────────────────────────────────
 *
 * Regla de oro: **no se promete lo que no se puede honrar**.
 *
 *   disponibles = min(stockTotal − stockUsed, floor(bunzBalance / bunzCost))
 *
 * El respaldo (`bunzBalance`) manda sobre el stock que el comercio declare: si
 * publica 200 cafés pero solo puede honrar 10, se muestran 10.
 */

export interface OfferLike {
  status?: string | null;
  stockTotal?: number | null;
  stockUsed?: number | null;
  bunzCost?: number | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function isOfferLive(offer: OfferLike, now: Date = new Date()): boolean {
  if (String(offer.status ?? "").toUpperCase() !== "ACTIVE") return false;
  const from = offer.validFrom ? new Date(offer.validFrom) : null;
  const until = offer.validUntil ? new Date(offer.validUntil) : null;
  if (from && from.getTime() > now.getTime()) return false;
  if (until && until.getTime() <= now.getTime()) return false;
  return true;
}

export function offerAvailableUnits(offer: OfferLike, bunzBalance: number): number {
  const stock = Math.max(0, n(offer.stockTotal) - n(offer.stockUsed));
  const cost = Math.max(1, n(offer.bunzCost));
  const byBacking = Math.floor(Math.max(0, n(bunzBalance)) / cost);
  return Math.max(0, Math.min(stock, byBacking));
}

/** ¿Se puede publicar? (stock real y respaldo para al menos un canje) */
export function isOfferPublicable(offer: OfferLike, bunzBalance: number, now: Date = new Date()): boolean {
  return isOfferLive(offer, now) && offerAvailableUnits(offer, bunzBalance) > 0;
}

/**
 * La oferta que se muestra en la tarjeta: la más barata que el negocio puede
 * honrar hoy (`bunzBalance` = respaldo del NEGOCIO, no del Rabbitter).
 * La asequibilidad del Rabbitter se calcula aparte con su propio saldo.
 */
export function pickOfferForCard<T extends OfferLike>(
  offers: T[],
  businessBacking: number,
  now: Date = new Date(),
): T | null {
  const live = offers
    .filter((o) => isOfferLive(o, now) && offerAvailableUnits(o, businessBacking) > 0)
    .sort((a, b) => n(a.bunzCost) - n(b.bunzCost));
  return live[0] ?? null;
}

/* ── Código de canje ──────────────────────────────────────────────────────── */

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo en el mostrador.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateOfferCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeOfferCode(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/** Vigencia del código: 24 h por defecto (se valida en el local). */
export function offerCodeExpiry(hours = 24, now: Date = new Date()): Date {
  return new Date(now.getTime() + Math.max(1, hours) * 3600_000);
}
