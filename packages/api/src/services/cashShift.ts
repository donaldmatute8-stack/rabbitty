import { and, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  cashDrops,
  cashShiftEvents,
  cashShifts,
  orders,
  payments,
  pinAttempts,
  staff,
} from "@rabbitty/database-restaurant/schema";
import { verifyPin } from "./crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const MANAGER_ROLES = ["ADMIN", "MANAGER"];
export const CASHIER_ROLES = ["CASHIER", "MANAGER", "ADMIN"];

// ---- Bloqueo por intentos fallidos de PIN (persistente en DB, compartido entre instancias) ----
// IMPORTANTE: pasar siempre la conexión raíz (no una transacción): si la mutación falla y hace
// rollback, el contador de intentos debe conservarse.
const MAX_FAILS = 5;
const LOCK_MINUTES = 5;
const WINDOW_MINUTES = 10;

async function assertNotLocked(db: Db, branchId: string) {
  // La comparación se hace en SQL (now() del servidor) para evitar desfases de zona horaria
  // entre timestamps sin zona y el reloj de la instancia.
  const res: any = await db.execute(
    sql`select ("lockedUntil" is not null and "lockedUntil" > now()) as locked from pin_attempts where "scopeKey" = ${`cash:${branchId}`}`
  );
  const rows: any[] = Array.isArray(res) ? res : res?.rows ?? [];
  if (rows[0]?.locked) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados PIN incorrectos. Espera 5 minutos o pide a un administrador.",
    });
  }
}

/** UPSERT atómico: incrementa el contador y fija lockedUntil al llegar al máximo. */
async function registerFail(db: Db, branchId: string) {
  const key = `cash:${branchId}`;
  await db.execute(sql`
    INSERT INTO pin_attempts ("scopeKey", "failCount", "lastFailAt", "lockedUntil")
    VALUES (${key}, 1, now(), NULL)
    ON CONFLICT ("scopeKey") DO UPDATE SET
      "failCount" = CASE
        WHEN pin_attempts."lastFailAt" < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1
        ELSE pin_attempts."failCount" + 1 END,
      "lastFailAt" = now(),
      "lockedUntil" = CASE
        WHEN (CASE WHEN pin_attempts."lastFailAt" < now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1
                   ELSE pin_attempts."failCount" + 1 END) >= ${MAX_FAILS}
        THEN now() + make_interval(mins => ${LOCK_MINUTES})
        ELSE NULL END
  `);
}

async function clearFails(db: Db, branchId: string) {
  await db.delete(pinAttempts).where(eq(pinAttempts.scopeKey, `cash:${branchId}`));
}

/** Identifica a un empleado activo de la sucursal por su PIN. Nunca expone el hash. */
export async function findStaffByPin(
  db: Db,
  branchId: string,
  pin: string,
  roles: string[],
  label = "PIN incorrecto"
) {
  await assertNotLocked(db, branchId);
  const list = await db
    .select()
    .from(staff)
    .where(and(eq(staff.branchId, branchId), eq(staff.isActive, true)));
  const normalized = roles.map((r) => r.toUpperCase());
  for (const s of list) {
    if (!s.pinCode || !normalized.includes(String(s.role).toUpperCase())) continue;
    if (verifyPin(pin, s.pinCode)) {
      await clearFails(db, branchId);
      return s as { id: string; name: string; role: string };
    }
  }
  await registerFail(db, branchId);
  throw new TRPCError({ code: "UNAUTHORIZED", message: label });
}

export async function getOpenShift(db: Db, branchId: string, registerId = "MAIN") {
  const [shift] = await db
    .select()
    .from(cashShifts)
    .where(
      and(
        eq(cashShifts.branchId, branchId),
        eq(cashShifts.registerId, registerId),
        eq(cashShifts.status, "OPEN")
      )
    )
    .limit(1);
  return shift ?? null;
}

/** Guard: las ventas en efectivo requieren turno abierto. */
export async function assertOpenShiftForCash(db: Db, branchId: string) {
  const shift = await getOpenShift(db, branchId);
  if (!shift) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "TURNO_CERRADO: Abre caja (con tu PIN y fondo inicial) antes de cobrar en efectivo.",
    });
  }
  return shift;
}

/** Totales de un turno. Efectivo esperado = fondo + ventas efectivo - retiros + ajustes de traspaso. */
export async function computeShiftTotals(db: Db, shift: { id: string; branchId: string; openingFloat: number; openedAt: Date; closedAt: Date | null }) {
  const until = shift.closedAt ?? new Date();
  const pays = await db
    .select({ method: payments.method, amount: payments.amount })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(orders.branchId, shift.branchId),
        eq(payments.status, "COMPLETED"),
        gte(payments.createdAt, shift.openedAt),
        lte(payments.createdAt, until)
      )
    );
  const sum = (m: string) => round2(pays.filter((p: any) => p.method === m).reduce((s: number, p: any) => s + Number(p.amount), 0));
  const cashSales = sum("CASH");
  const cardSales = round2(sum("CREDIT_CARD") + sum("DEBIT_CARD"));
  const bunzSales = sum("BUNZ");

  const [d] = await db
    .select({ total: sql<number>`coalesce(sum(${cashDrops.amount}), 0)` })
    .from(cashDrops)
    .where(eq(cashDrops.shiftId, shift.id));
  const withdrawals = round2(Number(d?.total ?? 0));

  const [a] = await db
    .select({ total: sql<number>`coalesce(sum(${cashShiftEvents.difference}), 0)` })
    .from(cashShiftEvents)
    .where(and(eq(cashShiftEvents.shiftId, shift.id), eq(cashShiftEvents.type, "HANDOVER")));
  const adjustments = round2(Number(a?.total ?? 0));

  const expectedCash = round2(shift.openingFloat + cashSales - withdrawals + adjustments);
  return {
    openingFloat: round2(shift.openingFloat),
    cashSales,
    cardSales,
    bunzSales,
    withdrawals,
    adjustments,
    expectedCash,
  };
}

export async function nameOf(db: Db, staffId?: string | null) {
  if (!staffId) return null;
  const [s] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId));
  return s?.name ?? null;
}

/**
 * Bloquea la fila del turno (SELECT ... FOR UPDATE) para que dos retiros,
 * traspasos o cierres concurrentes no puedan calcular totales sobre el mismo
 * estado y dejar la gaveta en negativo. Debe llamarse dentro de una transacción.
 */
export async function lockShift(db: Db, shiftId: string) {
  const res: any = await db.execute(sql`select id, status from cash_shifts where id = ${shiftId} for update`);
  const rows: any[] = Array.isArray(res) ? res : res?.rows ?? [];
  if (!rows[0] || rows[0].status !== "OPEN") {
    throw new TRPCError({ code: "CONFLICT", message: "El turno ya fue cerrado." });
  }
}
