// server-only

/**
 * ── categorías de push ── RE-EXPORTS del contrato canónico (@rabbitty/events).
 * Fuente única de verdad: `packages/events/src/index.ts` (PushCategory,
 * categoryForType, typeMuted, UNMUTABLE_TYPES). Nada aquí duplica la lógica —
 * cualquier cambio de catálogo de categorías vive en el contrato.
 */
export {
  PushCategory,
  categoryForType as categoryForPushType,
  typeMuted as typePushMuted,
  UNMUTABLE_TYPES as UNMUTABLE_PUSH_TYPES,
} from "@rabbitty/events";

/** Catálogo visible en settings (UI) — labels es-MX, no sensible al contrato. */
export const PUSH_CATEGORY_LIST = [
  "chat", "rewards", "orders", "proximity", "memberships", "marketing",
] as const;

export type PushCategoryKey = (typeof PUSH_CATEGORY_LIST)[number];

export const PUSH_CATEGORY_LABELS: Record<PushCategoryKey, { label: string; desc: string }> = {
  chat: { label: "Chat y mensajes", desc: "Conversaciones con negocios y amigos" },
  rewards: { label: "Recompensas Bunz", desc: "Ganancias, gastos y transferencias" },
  orders: { label: "Órdenes y cuentas", desc: "Pago confirmado, cuenta enviada, propinas" },
  proximity: { label: "Cercanía al local", desc: "Llegada y recordatorios de check-in" },
  memberships: { label: "Membresías", desc: "Altas, renovaciones y revocaciones" },
  marketing: { label: "Marketing y ofertas", desc: "Ofertas flash y campañas de tus lugares" },
};

/** Parse seguro de la columna users.pushMutedCategories (JSON string array). */
export function parseMutedCategories(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
