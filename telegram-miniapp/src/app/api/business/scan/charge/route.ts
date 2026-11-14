import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { restaurantDb } from "@/db/restaurant";
import {
  branches,
  orders,
  posChargeRequests,
  restaurants,
} from "@rabbitty/database-restaurant/schema";
import { notificationsOutbox } from "@rabbitty/database-core/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Cobro en Bunz desde el escáner del negocio (ADR-027) ───────────────────
 *
 * El dueño escanea el QR de un Rabbitter y le cobra **solo con Bunz**, sin abrir
 * el POS. NO es una vía paralela: crea una orden real (visible en POS, turnos y
 * reportes), usa el motor canónico y exige la aprobación del cliente en su app.
 *
 * Este endpoint solo CREA la orden y la solicitud de aprobación; la captura se
 * hace en `/api/business/scan/charge/settle` cuando el cliente aprueba.
 */

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const TAX_RATE = 0.16;
const MAX_AMOUNT = 5_000;
/** Tolerancia de presencia: el cobro debe originarse cerca del negocio. */
const MAX_DISTANCE_M = 300;

const schema = z.object({
  businessId: z.string().uuid(),
  customerId: z.string().min(1),
  amount: z.number().positive().max(MAX_AMOUNT),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 400 });
  }
  const { businessId, customerId, amount, lat, lng } = parsed.data;

  const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
  if (!business) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  if (business.ownerId !== caller.id) {
    return NextResponse.json({ error: "Solo el dueño del negocio puede cobrar aquí" }, { status: 403 });
  }

  // ── Presencia: el cobro se origina en el local, no a distancia ──
  if (business.lat != null && business.lng != null) {
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Necesitamos tu ubicación para cobrar. Activa el GPS y el Wi-Fi del local." },
        { status: 428 },
      );
    }
    const meters = distanceMeters(Number(business.lat), Number(business.lng), lat, lng);
    if (meters > MAX_DISTANCE_M) {
      return NextResponse.json(
        { error: `Estás a ${meters} m del negocio. El cobro solo se permite en el local.` },
        { status: 403 },
      );
    }
  }

  // ── Cliente ──
  const [customer] = await db
    .select({
      id: users.id,
      name: users.firstName,
      username: users.username,
      earned: users.totalBunzEarned,
      spent: users.totalBunzSpent,
    })
    .from(users)
    .where(eq(users.id, customerId))
    .limit(1);
  if (!customer) return NextResponse.json({ error: "Rabbitter no encontrado" }, { status: 404 });

  const balance = Math.max(0, Number(customer.earned ?? 0) - Number(customer.spent ?? 0));
  if (balance < amount) {
    return NextResponse.json(
      { error: `Saldo insuficiente: tiene ${balance} Bunz y el cobro es de ${amount}.` },
      { status: 402 },
    );
  }

  // ── Sucursal del negocio ──
  const [restaurant] = await restaurantDb
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.businessId, businessId))
    .limit(1);
  if (!restaurant) return NextResponse.json({ error: "El negocio no tiene sucursal configurada" }, { status: 409 });

  const [branch] = await restaurantDb
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.restaurantId, restaurant.id), eq(branches.isActive, true)))
    .limit(1);
  if (!branch) return NextResponse.json({ error: "No hay sucursal activa" }, { status: 409 });

  // ── Orden real (aparece en POS, turnos y reportes) ──
  const total = round(amount);
  const subtotal = round(total / (1 + TAX_RATE));
  const tax = round(total - subtotal);

  const [order] = await restaurantDb
    .insert(orders)
    .values({
      branchId: branch.id,
      orderType: "TO_GO",
      status: "PENDING",
      subtotal,
      tax,
      total,
      customerId: customer.id,
      customerName: customer.name ?? customer.username ?? null,
      notes: "Cobro en mostrador (Bunz)",
    })
    .returning({ id: orders.id });
  if (!order) return NextResponse.json({ error: "No se pudo crear la orden" }, { status: 500 });

  // Sin líneas de platillo: es un cobro de mostrador, no una comanda.
  // La orden lleva los totales (POS, turnos y reportes leen de `orders`) y no
  // toca inventario ni la cola de cocina.

  const [approval] = await restaurantDb
    .insert(posChargeRequests)
    .values({
      branchId: branch.id,
      customerId: customer.id,
      staffId: null,
      method: "BUNZ",
      amount: total,
      items: [{ name: "Consumo en mostrador", quantity: 1, totalPrice: total }],
      businessName: business.name,
      status: "PENDING",
      orderId: order.id,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    })
    .returning({ id: posChargeRequests.id });
  if (!approval) return NextResponse.json({ error: "No se pudo pedir la aprobación" }, { status: 500 });

  // Aviso al cliente para que apruebe en su app.
  await db
    .insert(notificationsOutbox)
    .values({
      userId: customer.id,
      type: "CHARGE_REQUEST",
      title: "Cobro en Bunz",
      message: `${business.name} solicita cobrar ${total.toFixed(2)} Bunz`,
      route: `/pay/confirm/${approval.id}`,
      data: { requestId: approval.id, businessId, amount: total, orderId: order.id },
      dedupeKey: `charge-${approval.id}`,
      priority: "high",
    })
    .onConflictDoNothing();

  return NextResponse.json({
    success: true,
    orderId: order.id,
    requestId: approval.id,
    amount: total,
    balance,
    customerName: customer.name ?? customer.username ?? "Rabbitter",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
}
