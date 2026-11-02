/**
 * ── bunzPaymentsPolicy ── H16: configuración comercial de pagos con Bunz.
 *
 * Dos niveles (decisión 2026-11-02):
 *   A. Reglas globales Rabbitty — SERVER-side, no modificables por el afiliado:
 *      saldo verificado server-side, atomicidad (ledger + idempotencia),
 *      0 cashback en ventas 100% Bunz (D-10), auditoría completa,
 *      titulardía = de la orden. Nada aquí puede cambiarlas.
 *   B. Comercial del afiliado — activar/desactivar, disponibilidad (ALWAYS /
 *      SCHEDULE), monto min/max por factura, límite diario de Bunz recibidos
 *      (guard atómico con advisory lock), sucursales avanzadas (después).
 *
 * Filosofía de UI: si NO puede usarse, no aparece — el server calcula la
 * disponibilidad y el cliente muestra la opción SOLO si available === true.
 * Para telemetría interna devolvemos `reason` (DISABLED|OUTSIDE_SCHEDULE|
 * LIMIT_REACHED|ORDER_OUT_OF_RANGE|INSUFFICIENT_BALANCE).
 */

export type BunzAvailabilityMode = "ALWAYS" | "SCHEDULE";

export interface BunzPaymentPolicy {
  /** master switch del negocio (restaurants.acceptsBunz) */
  enabled: boolean;
  availabilityMode: BunzAvailabilityMode;
  /** { days: [0=Dom..6=Sáb], start: "HH:MM", end: "HH:MM" } */
  schedule: { days: number[]; start: string; end: string } | null;
  /** 0 = sin mínimo */
  minOrderAmount: number;
  /** 0 = sin máximo */
  maxOrderAmount: number;
  /** Bunz diarios máximos recibidos; 0 = sin límite */
  dailyBunzLimit: number;
  timezone: string;
  /** H16-2: % máximo de factura pagable (100 = todo) */
  maxPctOfBill?: number;
  /** H16-2: menuIds admisibles; [] = todos */
  allowedProducts?: string[];
}

export type BunzUnavailableReason =
  | "DISABLED"
  | "OUTSIDE_SCHEDULE"
  | "LIMIT_REACHED"
  | "ORDER_OUT_OF_RANGE"
  | "INSUFFICIENT_BALANCE";

export interface BunzEligibilityInput {
  /** consumo pendiente de la orden (server-side siempre) */
  owed: number;
  /** balance actual del comensal (server-side) */
  balance: number;
  /** Bunz ya recibidos HOY por el negocio (por el guard del día) */
  receivedToday: number;
  now?: Date;
}

export interface BunzEligibility {
  available: boolean;
  reason: BunzUnavailableReason | null;
  /** bunz estimados de la operación (owed en Bunz 1:1 por diseño) */
  amountBunz: number;
  /** cuánto del límite diario quedará tras la operación */
  dailyRemainingAfter?: number;
}

export function parseBunzPolicy(raw: Record<string, unknown> | null | undefined, timezone: string): BunzPaymentPolicy {
  const scheduleRaw = raw?.bunzScheduleJson ?? raw?.bunzSchedule ?? null;
  let schedule: { days: number[]; start: string; end: string } | null = null;
  if (typeof scheduleRaw === "string" && scheduleRaw.trim() && scheduleRaw.trim() !== "{}") {
    try {
      const parsed = JSON.parse(scheduleRaw) as { days?: unknown; start?: unknown; end?: unknown };
      if (Array.isArray(parsed.days)) {
        const days = (parsed.days as unknown[])
          .map((d) => Number(d))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        const start = typeof parsed.start === "string" ? parsed.start : "";
        const end = typeof parsed.end === "string" ? parsed.end : "";
        if (days.length > 0 && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) {
          schedule = { days, start, end };
        }
      }
    } catch {
      schedule = null;
    }
  }
  const mode = String(raw?.bunzAvailabilityMode ?? "ALWAYS");
  return {
    enabled: raw?.acceptsBunz === true,
    availabilityMode: mode === "SCHEDULE" ? "SCHEDULE" : "ALWAYS",
    schedule,
    minOrderAmount: Math.max(0, Number(raw?.bunzMinOrderAmount ?? 0) || 0),
    maxOrderAmount: Math.max(0, Number(raw?.bunzMaxOrderAmount ?? 0) || 0),
    dailyBunzLimit: Math.max(0, Math.floor(Number(raw?.bunzDailyLimit ?? 0) || 0)),
    timezone: timezone || "America/Mexico_City",
  };
}

/** Hora/día del local (no del server) para evaluar el ventana del schedule. */
export function localTimeInfo(date: Date, timezone: string): { weekday: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => parts.find((p) => String(p.type) === t)?.value ?? "";
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = weekdayMap[String(get("weekday")).slice(0, 3)] ?? 0;
    const hour = Number(String(get("hour")).slice(0, 2)) % 24;
    const minute = Number(String(get("minute")).slice(0, 2));
    return { weekday: wd, minutes: hour * 60 + minute };
  } catch {
    return { weekday: 0, minutes: 0 };
  }
}

export function isWithinSchedule(policy: BunzPaymentPolicy, now: Date = new Date()): boolean {
  if (policy.availabilityMode !== "SCHEDULE" || !policy.schedule) return true;
  const { weekday, minutes } = localTimeInfo(now, policy.timezone);
  const { days, start, end } = policy.schedule;
  if (!days.map(String).includes(String(weekday))) return false;
  const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  const s = toMin(start);
  const e = toMin(end);
  if (e >= s) return minutes >= s && minutes <= e;
  // cruce de medianoche (ej. 21:00 → 02:00)
  return minutes >= s || minutes <= e;
}

export function evaluateBunzEligibility(
  policy: BunzPaymentPolicy,
  input: BunzEligibilityInput,
  now: Date = new Date()
): BunzEligibility {
  const amountBunz = Math.max(0, Number(input.owed || 0));

  if (!policy.enabled) return { available: false, reason: "DISABLED", amountBunz };
  if (!isWithinSchedule(policy, now)) return { available: false, reason: "OUTSIDE_SCHEDULE", amountBunz };

  if (policy.minOrderAmount > 0 && amountBunz < policy.minOrderAmount) {
    return { available: false, reason: "ORDER_OUT_OF_RANGE", amountBunz };
  }
  if (policy.maxOrderAmount > 0 && amountBunz > policy.maxOrderAmount) {
    return { available: false, reason: "ORDER_OUT_OF_RANGE", amountBunz };
  }

  if (policy.dailyBunzLimit > 0) {
    const remainingAfter = Math.max(0, policy.dailyBunzLimit - (Number(input.receivedToday || 0) + amountBunz));
    if (Number(input.receivedToday || 0) + amountBunz > policy.dailyBunzLimit) {
      return { available: false, reason: "LIMIT_REACHED", amountBunz, dailyRemainingAfter: 0 };
    }
    if (input.balance < amountBunz) {
      return { available: false, reason: "INSUFFICIENT_BALANCE", amountBunz, dailyRemainingAfter: remainingAfter };
    }
    return { available: true, reason: null, amountBunz, dailyRemainingAfter: remainingAfter };
  }

  if (input.balance < amountBunz) {
    return { available: false, reason: "INSUFFICIENT_BALANCE", amountBunz };
  }
  return { available: true, reason: null, amountBunz };
}

// H16-2: override por sucursal — keys opcionales que reemplazan al negocio
export interface BunzBranchOverride {
  enabled?: boolean;
  availabilityMode?: BunzAvailabilityMode;
  schedule?: { days: number[]; start: string; end: string } | null;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  dailyBunzLimit?: number;
  maxPctOfBill?: number;
  allowedProducts?: string[];
}

export function parseBranchOverride(raw: unknown): BunzBranchOverride {
  if (typeof raw !== "string" || !raw.trim() || raw.trim() === "{}") return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: BunzBranchOverride = {};
    if (typeof obj.enabled === "boolean") out.enabled = obj.enabled;
    if (obj.availabilityMode === "ALWAYS" || obj.availabilityMode === "SCHEDULE") out.availabilityMode = obj.availabilityMode;
    if (obj.schedule && typeof obj.schedule === "object") {
      const sc = obj.schedule as { days?: unknown; start?: unknown; end?: unknown };
      if (Array.isArray(sc.days)) {
        out.schedule = {
          days: sc.days.map((d) => Number(d)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
          start: typeof sc.start === "string" ? sc.start : "09:00",
          end: typeof sc.end === "string" ? sc.end : "22:00",
        };
      }
    }
    if (typeof obj.minOrderAmount === "number") out.minOrderAmount = Math.max(0, obj.minOrderAmount);
    if (typeof obj.maxOrderAmount === "number") out.maxOrderAmount = Math.max(0, obj.maxOrderAmount);
    if (typeof obj.dailyBunzLimit === "number") out.dailyBunzLimit = Math.max(0, Math.floor(obj.dailyBunzLimit));
    if (typeof obj.maxPctOfBill === "number") out.maxPctOfBill = Math.min(100, Math.max(0, Math.floor(obj.maxPctOfBill)));
    if (Array.isArray(obj.allowedProducts)) {
      out.allowedProducts = (obj.allowedProducts as unknown[]).filter((x): x is string => typeof x === "string");
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge: la política del negocio con el override de la sucursal encima. */
export function mergeBranchOverride(base: BunzPaymentPolicy, override: BunzBranchOverride): BunzPaymentPolicy {
  if (Object.keys(override).length === 0) return base;
  const merged: BunzPaymentPolicy = { ...base };
  if (override.enabled !== undefined) merged.enabled = override.enabled;
  if (override.availabilityMode) merged.availabilityMode = override.availabilityMode;
  if (override.schedule !== undefined) merged.schedule = override.schedule;
  if (override.minOrderAmount !== undefined) merged.minOrderAmount = override.minOrderAmount;
  if (override.maxOrderAmount !== undefined) merged.maxOrderAmount = override.maxOrderAmount;
  if (override.dailyBunzLimit !== undefined) merged.dailyBunzLimit = override.dailyBunzLimit;
  if (override.maxPctOfBill !== undefined) merged.maxPctOfBill = override.maxPctOfBill;
  if (override.allowedProducts !== undefined) merged.allowedProducts = override.allowedProducts;
  return merged;
}

/**
 * Bunz pagables de la factura (H16-2): filtra por productos admisibles y al
 * cap del % de la factura. Devuelve el monto MXN pagable EN Bunz.
 */
export function computeBunzPayable(
  items: Array<{ id?: string; menuItemId?: string; totalPrice: number } | { id: string; name: string; totalPrice: number }>,
  totalFloat: number,
  policy: BunzPaymentPolicy
): { payable: number; allEligible: boolean } {
  const allowed = (policy as BunzPaymentPolicy & { allowedProducts?: string[] }).allowedProducts ?? [];
  const totalItems = items.reduce((acc, i) => acc + Number((i as { totalPrice: number }).totalPrice || 0), 0);
  if (allowed.length === 0 || totalItems === 0) {
    // sin filtro de productos: cuenta entera pagable (por offset de tax/incl)
    const byPct = Math.min(totalFloat, round2(totalFloat * ((policy.maxPctOfBill ?? 100) / 100)));
    return { payable: round2(Math.min(totalFloat, byPct)), allEligible: true };
  }
  const allowedSet = new Set(allowed);
  const eligibleSum = items
    .filter((it) => allowedSet.has(String((it as { id?: string; menuItemId?: string }).id ?? (it as { menuItemId?: string }).menuItemId ?? "")))
    .reduce((acc, it) => acc + Number((it as { totalPrice: number }).totalPrice || 0), 0);
  const share = totalItems > 0 ? eligibleSum / totalItems : 0; // proporción de la factura (incl IVA)
  const payable = round2(Math.min(totalFloat, totalFloat * share));
  const byPct = round2(totalFloat * ((policy.maxPctOfBill ?? 100) / 100));
  const bounded = round2(Math.min(payable, byPct));
  return { payable: bounded, allEligible: eligibleSum >= totalItems };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
