import { and, eq } from 'drizzle-orm';
import { cashShifts, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { isBusinessOpen } from '@/lib/chat';

/**
 * ── ¿Se puede pedir ahora? (horario + caja) ────────────────────────────────
 *
 * Un solo lugar decide si el local recibe pedidos. Antes cada endpoint tenía
 * su propia puerta (`isBusinessOpen` en el checkout, otra en el chat) y la app
 * no sabía nada: el Rabbitter armaba el pedido y el servidor lo rechazaba al
 * final, sin que se enterara. Aquí se calcula el estado y el texto que ve el
 * cliente, y el checkout usa exactamente la misma regla.
 *
 * Reglas:
 *  · Horario abierto  + caja abierta  → OPEN      (todo normal)
 *  · Horario abierto  + caja cerrada  → NO_TILL   (se acepta; se avisa que el
 *    local todavía no está cobrando)
 *  · Horario cerrado  + caja abierta  → EXTENDED  (el local sigue atendiendo:
 *    se acepta, el horario es una promesa, no un candado)
 *  · Horario cerrado  + caja cerrada  → CLOSED    (no se acepta y se dice cuándo)
 */

export type OrderingState = 'OPEN' | 'NO_TILL' | 'EXTENDED' | 'CLOSED';

export interface OrderingSchedule {
  activeDays: number[];
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface OrderingStatus {
  /** El motor de pedidos acepta órdenes ahora. */
  canOrder: boolean;
  state: OrderingState;
  scheduleOpen: boolean;
  cashShiftOpen: boolean;
  /** Mensaje listo para mostrar al Rabbitter (null si todo normal). */
  message: string | null;
  /** Tono sugerido para el aviso. */
  tone: 'success' | 'info' | 'warn' | 'error';
  schedule: OrderingSchedule;
  /** "hoy 09:00", "mañana 09:00", "el jueves 09:00"… (solo si está cerrado). */
  nextOpenLabel: string | null;
}

const WEEKDAY_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function parseDays(raw: unknown): number[] {
  try {
    const parsed = JSON.parse(String(raw ?? ''));
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(Number).filter((d) => !Number.isNaN(d));
    }
  } catch {
    /* default: todos los días */
  }
  return [1, 2, 3, 4, 5, 6, 7];
}

/** Día (1=Lun…7=Dom) y minutos del reloj en la zona del negocio. */
function localClock(timezone: string): { day: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hourCycle: 'h23',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date());
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return {
      day: map[pick('weekday')] ?? 1,
      minutes: (Number(pick('hour')) % 24) * 60 + Number(pick('minute')),
    };
  } catch {
    const now = new Date();
    const jsDay = now.getDay(); // 0=Dom
    return {
      day: jsDay === 0 ? 7 : jsDay,
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

function nextOpenLabel(schedule: OrderingSchedule): string | null {
  const { day, minutes } = localClock(schedule.timezone);
  const opens = Number(schedule.startTime.split(':')[0] || 0) * 60 + Number(schedule.startTime.split(':')[1] || 0);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = ((day - 1 + offset) % 7) + 1;
    if (!schedule.activeDays.includes(candidate)) continue;
    if (offset === 0 && minutes >= opens) continue; // hoy ya pasó la apertura
    const when = offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : `el ${WEEKDAY_ES[candidate % 7]}`;
    return `${when} ${schedule.startTime}`;
  }
  return null;
}

/** ¿Hay un turno de caja abierto en la sucursal? */
export async function hasOpenCashShift(
  db: { select: (...args: unknown[]) => any },
  branchId: string | null | undefined,
): Promise<boolean> {
  if (!branchId) return false;
  try {
    const rows = await db
      .select({ id: cashShifts.id })
      .from(cashShifts)
      .where(and(eq(cashShifts.branchId, branchId), eq(cashShifts.status, 'OPEN')))
      .limit(1);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    // Si la consulta falla no se bloquea al cliente por un error de lectura.
    return false;
  }
}

/** ¿Alguna sucursal del negocio tiene un turno de caja abierto? */
export async function hasOpenCashShiftForBusiness(
  db: { select: (...args: unknown[]) => any },
  businessId: string,
): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: cashShifts.id })
      .from(cashShifts)
      .innerJoin(branches, eq(branches.id, cashShifts.branchId))
      .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .where(and(eq(restaurants.businessId, businessId), eq(cashShifts.status, 'OPEN')))
      .limit(1);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Resuelve la sucursal de producción del negocio (misma regla que checkout). */
export async function resolveProductionBranchId(
  db: { select: (...args: unknown[]) => any },
  branchOrBusinessId: string,
): Promise<string | null> {
  const [byId] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, branchOrBusinessId)).limit(1);
  if (byId) return byId.id as string;

  const byBusiness = await db
    .select({ id: branches.id, name: branches.name, isActive: branches.isActive })
    .from(branches)
    .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
    .where(eq(restaurants.businessId, branchOrBusinessId));

  if (!Array.isArray(byBusiness) || byBusiness.length === 0) return null;
  const active = byBusiness.filter((b: any) => b.isActive !== false);
  const production =
    active.find((b: any) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
    active[0] ??
    byBusiness[0];
  return (production?.id as string) ?? null;
}

export async function resolveOrderingStatus(
  db: { select: (...args: unknown[]) => any },
  input: {
    branchId: string | null;
    activeDays?: unknown;
    startTime?: string | null;
    endTime?: string | null;
    timezone?: string | null;
  },
): Promise<OrderingStatus> {
  const schedule: OrderingSchedule = {
    activeDays: parseDays(input.activeDays),
    startTime: input.startTime || '09:00',
    endTime: input.endTime || '20:00',
    timezone: input.timezone || 'America/Mexico_City',
  };

  const scheduleOpen = isBusinessOpen(
    {
      activeDays: JSON.stringify(schedule.activeDays),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      timezone: schedule.timezone,
    },
  );
  const cashShiftOpen = await hasOpenCashShift(db, input.branchId);

  if (scheduleOpen && cashShiftOpen) {
    return {
      canOrder: true,
      state: 'OPEN',
      scheduleOpen,
      cashShiftOpen,
      message: null,
      tone: 'success',
      schedule,
      nextOpenLabel: null,
    };
  }

  if (scheduleOpen && !cashShiftOpen) {
    return {
      canOrder: true,
      state: 'NO_TILL',
      scheduleOpen,
      cashShiftOpen,
      message:
        'El local aún no abre caja. Tu pedido sí llega al POS y se cobra cuando abran; si tienes prisa, paga en el mostrador.',
      tone: 'warn',
      schedule,
      nextOpenLabel: null,
    };
  }

  if (!scheduleOpen && cashShiftOpen) {
    return {
      canOrder: true,
      state: 'EXTENDED',
      scheduleOpen,
      cashShiftOpen,
      message: 'El local sigue atendiendo fuera de su horario. Tu pedido entra normal.',
      tone: 'info',
      schedule,
      nextOpenLabel: null,
    };
  }

  const next = nextOpenLabel(schedule);
  return {
    canOrder: false,
    state: 'CLOSED',
    scheduleOpen,
    cashShiftOpen,
    message: next
      ? `El local está cerrado. Abre ${next}.`
      : 'El local está cerrado y no cobra pedidos ahora.',
    tone: 'error',
    schedule,
    nextOpenLabel: next,
  };
}
