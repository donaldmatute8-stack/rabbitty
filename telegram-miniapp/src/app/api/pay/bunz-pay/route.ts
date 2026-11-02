import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { restaurantDb } from "@/db/restaurant";
import { orders, branches, restaurants, payments } from "@rabbitty/database-restaurant/schema";
import { and, eq, sql } from "drizzle-orm";
import { parseBunzPolicy, evaluateBunzEligibility, type BunzEligibility, type BunzUnavailableReason } from "@/lib/bunzPaymentsPolicy";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * ── /api/pay/bunz-pay ── H15: pagar la cuenta ENVIADA 100% con Bunz (sin QR).
 * El comensal abre /pay/[orderId] desde la notificación "Cuenta lista":
 * si tiene saldo suficiente y el negocio acepta Bunz (acceptsBunz), paga la
 * cuenta entera con el motor central (PaymentIntentService) — el settle:
 *   · debita Bunz del comensal (ledger SPEND)
 *   · marca la orden COMPLETED + payments row (POS watcher la ve al vuelo)
 *   · NO emite cashback (D-10: los Bunz no generan Bunz — fiat 0)
 * Idempotencia: payments.createIntent por idempotencyKey `bill_bunz_{orderId}`
 * (re-calls reutilizan el mismo intent; approveIntent dedupe SETTLED).
 *
 * La propina se paga EN BUNZ si ya fue elegida (users pueden agregarla antes
 * de tocar Pagar con Bunz en el sheet; no se marca en fiat).
 *
 * GET  → balance + deuda restante + acceptsBunz + si puede pagar
 * POST { orderId, tipAmount? } → ejecuta el pago con Bunz (PIN gate en cliente)
 */
async function loadRestaurantForBranch(branchId: string | null) {
  if (!branchId) return null;
  const [branch] = await restaurantDb
    .select({ restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branch?.restaurantId) return null;
  const [rest] = await restaurantDb
    .select({ id: restaurants.id, acceptsBunz: restaurants.acceptsBunz, name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, branch.restaurantId))
    .limit(1);
  return rest ?? null;
}

async function owedForOrder(orderId: string): Promise<number> {
  const completed = await restaurantDb
    .select({ total: payments.amount })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "COMPLETED")));
  const paid = completed.reduce((s, p) => s + Number(p.total || 0), 0);
  return Math.max(0, paid);
}


/** ── H16 (Nivel A) — política + recepción de hoy server-side SIEMPRE ── */
async function loadPolicyAndReceivedToday(branchId: string | null): Promise<{
  policy: ReturnType<typeof parseBunzPolicy>;
  receivedToday: number;
}> {
  let raw: Record<string, unknown> | null = null;
  let tz = "America/Mexico_City";
  if (branchId) {
    const [branch] = await restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    if (branch?.restaurantId) {
      const [rest] = await restaurantDb
        .select({
          acceptsBunz: restaurants.acceptsBunz,
          mode: restaurants.bunzAvailabilityMode,
          schedule: restaurants.bunzSchedule,
          minOrder: restaurants.bunzMinOrderAmount,
          maxOrder: restaurants.bunzMaxOrderAmount,
          dailyLimit: restaurants.bunzDailyLimit,
          tz: restaurants.timezone,
        })
        .from(restaurants)
        .where(eq(restaurants.id, branch.restaurantId))
        .limit(1);
      if (rest) {
        raw = {
          acceptsBunz: rest.acceptsBunz,
          bunzAvailabilityMode: rest.mode,
          bunzSchedule: rest.schedule,
          bunzMinOrderAmount: rest.minOrder,
          bunzMaxOrderAmount: rest.maxOrder,
          bunzDailyLimit: rest.dailyLimit,
        };
        tz = rest.tz || tz;
      }
    }
  }
  const policy = parseBunzPolicy(raw, tz);

  // Bunz recibidos HOY por el negocio (proxyatura: payments BUNZ COMPLETED en
  // la branch, localizado por timezone del comercio — recorte calendar del día).
  const receivedToday = await restaurantDb
    .select({ total: sql<number>`COUNT(*)*0 + COALESCE(SUM(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(
      eq(payments.method, "BUNZ"),
      eq(payments.status, "COMPLETED"),
      eq(orders.branchId, branchId || "x-y-z-nulo"),
      sql`(${payments.createdAt} AT TIME ZONE ${policy.timezone})::date = (now() AT TIME ZONE ${policy.timezone})::date`
    ))
    .then((rows) => Number((rows[0] as Record<string, unknown>)?.total ?? 0))
    .catch(() => 0 as number);

  return { policy, receivedToday };
}

const ADMIN_TRPC = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://admin.rabbitty.me/api/trpc';

// tRPC mutation batch proxy (input en el cuerpo, es el mismo patrón de /api/pay/setup)
async function callAdmin(procedure: string, input: unknown): Promise<Record<string, unknown>> {
  const url = `${ADMIN_TRPC}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ '0': input }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => null)) as any;
  const first = Array.isArray(json) ? json[0] : json;
  const errMsg = first?.error?.message ?? first?.error?.json?.message;
  if (!first || first.error || errMsg) {
    throw new Error(errMsg || `Error llamando a ${procedure} (${res.status})`);
  }
  return (first?.result?.data ?? {}) as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const orderId = new URL(req.url).searchParams.get('orderId') || '';
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 });

    const owed = await owedForOrder(orderId);
    const remaining = Math.max(0, Number(order.total || 0) - owed);

    const rest = await loadRestaurantForBranch(order.branchId);
    const acceptsBunz = Boolean(rest?.acceptsBunz ?? true);

    const [userRow] = await db
      .select({ earned: users.totalBunzEarned, spent: users.totalBunzSpent })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);
    const balance = Math.max(0, Number(userRow?.earned ?? 0) - Number(userRow?.spent ?? 0));

    // H16: disponibilidad calculada SERVER-side por la política (Nivel B)
    const { policy, receivedToday } = await loadPolicyAndReceivedToday(order.branchId);
    const eligibility = evaluateBunzEligibility(policy, {
      owed: remaining,
      balance,
      receivedToday,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      total: Number(order.total || 0),
      owed: remaining,
      balance,
      acceptsBunz,
      available: eligibility.available,
      unavailableReason: eligibility.reason,
      dailyBunzLimit: policy.dailyBunzLimit,
      receivedToday,
      canPayWithBunz: eligibility.available,
      businessName: rest?.name || null,
      status: order.status,
    });
  } catch (err: unknown) {
    console.error('[PAY_BUNZ_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Error al leer el estado del pago' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const rate = await checkRateLimit(`pay_bunz:${caller.id}`, 8, 60);
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 });
    const settledStates = new Set(['COMPLETED', 'PAID', 'VOID', 'VOIDED']);
    if (settledStates.has(String(order.status))) {
      return NextResponse.json({ ok: false, error: 'Esta cuenta ya fue pagada' }, { status: 409 });
    }

    // El pagador tiene que ser el cliente vinculado a la orden (o su dueño si es anónima)
    if (order.customerId && order.customerId !== caller.id) {
      return NextResponse.json({ ok: false, error: 'No puedes pagar una cuenta que no es tuya' }, { status: 403 });
    }

    // H16: política comercial (Nivel B) + guard atómico del límite diario
    const rest = await loadRestaurantForBranch(order.branchId);

    // 🔒 Anti-fraude: el monto se calcula SIEMPRE server-side (total − pagado),
    // nunca se confía en un amount del body.
    const prePaid = await owedForOrder(orderId);
    const owed = Math.max(0, Number(order.total || 0) - prePaid);
    if (owed <= 0) {
      return NextResponse.json({ ok: false, error: 'Esta cuenta ya está liquidada' }, { status: 409 });
    }

    const [userRow] = await db
      .select({ earned: users.totalBunzEarned, spent: users.totalBunzSpent })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);
    const balance = Math.max(0, Number(userRow?.earned ?? 0) - Number(userRow?.spent ?? 0));

    // Nivel A+ B evaluado server-side — el affilado no puede tocar reglas
    const { policy, receivedToday } = await loadPolicyAndReceivedToday(order.branchId);
    const eligibility0 = evaluateBunzEligibility(policy, { owed, balance, receivedToday });
    if (!eligibility0.available) {
      return NextResponse.json({
        ok: false,
        error: 'Pagos con Bunz no disponibles para esta cuenta: ' + eligibility0.reason,
        code: eligibility0.reason,
      }, { status: 400 });
    }

    // Límite diario ATÓMICO (advisory lock por negocio): waiting other bunz-pay
    // get serialized here — dos pagos concurrentes no exceden el máximo.
    const businessKey = String(order.branchId || rest?.id || 'unknown');
    const result = await restaurantDb.transaction(async (guardTx: { execute: (q: any) => Promise<unknown> }) => {
      await guardTx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${businessKey}))`);
      const { receivedToday: recvNow } = await loadPolicyAndReceivedToday(order.branchId);
      const elig = evaluateBunzEligibility(policy, { owed, balance, receivedToday: recvNow });
      if (!elig.available) {
        return { ok: false, error: 'Pagos con Bunz no disponibles esta vez', reason: elig.reason ?? 'LIMIT_REACHED' };
      }
      // (el lock se mantiene hasta terminar el settle — atomicidad real)
      let localError: string | null = null;
      let wrapped: Record<string, unknown> | null = null;
      try {
        const intent = await callAdmin('payments.createIntent', {
          orderId,
          amountMxn: owed,
          idempotencyKey: `bill_bunz_${orderId}`,
        });
        const intentId = String(intent?.id ?? '');
        if (!intentId) throw new Error('No se pudo crear el intent del pago');
        const approved = await callAdmin('payments.approveIntent', { intentId });
        wrapped = { intentId, approved };
      } catch (err: unknown) {
        localError = err instanceof Error ? err.message : 'No se pudo ejecutar el pago con Bunz';
      }
      if (localError) throw new Error(localError);
      return { ok: true, ...wrapped };
    }) as { ok: boolean; error?: string; reason?: string; intentId?: string; approved?: Record<string, unknown> } | null;
    if (result && result.ok === false) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Pagos con Bunz no disponibles', code: result.reason },
        { status: 400 }
      );
    }
    const approved = (result?.approved ?? {}) as Record<string, unknown>;
    const paidAmount = Number(approved?.amountMxn ?? owed);

    return NextResponse.json({
      ok: true,
      success: true,
      orderId,
      paid: paidAmount,
      intentId: String(result?.intentId ?? ''),
      note: 'Cuenta liquidada con Bunz — POS watcher y tabs refrescados server-side',
    });
  } catch (err: any) {
    const msg = String(err?.message || 'No se pudo pagar con Bunz').slice(0, 180);
    console.error('[PAY_BUNZ_POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
