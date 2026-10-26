import { NextRequest, NextResponse } from "next/server";
import { restaurantDb } from "@/db/restaurant";
import { db } from "@/db";
import { users } from "@/db/schema";
import { tables, tableSessions, orders, branches } from "@rabbitty/database-restaurant/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Autenticación requerida para vincularse a la mesa." }, { status: 401 });
    }

    // Rate Limiting anti-bruteforce: Máx 10 reclamos por minuto por usuario
    const rate = await checkRateLimit(`claim_table:${caller.id}`, 10, 60);
    if (!rate.allowed) {
      return NextResponse.json({ 
        error: `Demasiados intentos de vinculación. Espera ${rate.retryAfterSeconds}s antes de reintentar.` 
      }, { status: 429 });
    }

    const body = await req.json();
    const { tableId, branchId, userLat, userLng } = body;

    if (!tableId || typeof tableId !== "string") {
      return NextResponse.json({ error: "tableId es requerido." }, { status: 400 });
    }

    // 1. Validar que la mesa exista
    const [table] = await restaurantDb
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      return NextResponse.json({ error: "Mesa no encontrada en el sistema." }, { status: 404 });
    }

    // 1a. Geofencing Hardening: Si el cliente envía GPS y la sucursal tiene coordenadas, validar cercanía física (< 200 metros)
    if (userLat != null && userLng != null && table.branchId) {
      const [branch] = await restaurantDb
        .select({ lat: branches.lat, lng: branches.lng, name: branches.name })
        .from(branches)
        .where(eq(branches.id, table.branchId))
        .limit(1);

      if (branch?.lat != null && branch?.lng != null) {
        const dist = getDistanceMeters(Number(userLat), Number(userLng), Number(branch.lat), Number(branch.lng));
        if (dist > 250) {
          return NextResponse.json({
            error: `Estás a ${dist}m de ${branch.name || "la sucursal"}. Para vincular tu mesa debes estar físicamente en el local.`,
            code: "GEOFENCE_EXCEEDED",
          }, { status: 403 });
        }
      }
    }

    // 1b. Carrera de reclamo: si la mesa ya está vinculada a OTRO Rabbitter, rechazar.
    const [existingClaimSession] = await restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "OPEN")))
      .limit(1);
    // También la orden PENDING de la mesa puede estar ya vinculada a otro comensal
    const [existingClaimOrder] = await restaurantDb
      .select({ customerId: orders.customerId })
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, "PENDING")))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    const alreadyClaimedBy = existingClaimSession?.customerId || existingClaimOrder?.customerId || null;
    if (alreadyClaimedBy && alreadyClaimedBy !== caller.id) {
      return NextResponse.json({
        error: "Esta mesa ya está vinculada a otro Rabbitter. Tu mesa/comanda te espera en otra mesa o pide a tu mesero.",
        code: "TABLE_ALREADY_CLAIMED",
      }, { status: 409 });
    }

    // 2. Extraer nombre del usuario de coreDb
    const [coreUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);

    const customerName = coreUser
      ? [coreUser.firstName, coreUser.lastName].filter(Boolean).join(" ") || coreUser.username || "Rabbitter"
      : caller.username || "Rabbitter";
    const customerPhone = coreUser?.phoneNumber || caller.phoneNumber || null;

    // 3. Si hay comanda PENDING abierta en esta mesa, asociar cliente
    const [pendingOrder] = await restaurantDb
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, "PENDING")))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (pendingOrder) {
      await restaurantDb
        .update(orders)
        .set({
          customerId: caller.id,
          customerName,
          customerPhone: customerPhone || pendingOrder.customerPhone,
        })
        .where(eq(orders.id, pendingOrder.id));
    }

    // 4. Asegurar una table_session en estado OPEN para esta mesa
    const [existingSession] = await restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "OPEN")))
      .limit(1);

    if (existingSession) {
      await restaurantDb
        .update(tableSessions)
        .set({ customerId: caller.id })
        .where(eq(tableSessions.id, existingSession.id));
    } else {
      await restaurantDb.insert(tableSessions).values({
        tableId,
        branchId: table.branchId,
        customerId: caller.id,
        status: "OPEN",
        customerCount: 1,
      });
    }

    return NextResponse.json({
      success: true,
      message: `¡Mesa #${table.number} vinculada exitosamente!`,
      table: {
        id: table.id,
        number: table.number,
        location: table.location,
        branchId: table.branchId,
      },
      hasActiveOrder: !!pendingOrder,
      orderId: pendingOrder?.id || null,
      orderTotal: pendingOrder ? Number(pendingOrder.total || 0) : 0,
      customer: {
        id: caller.id,
        name: customerName,
        phone: customerPhone,
      },
    });
  } catch (err: any) {
    console.error("[CLAIM_TABLE_SESSION_ERROR]", err);
    return NextResponse.json({ error: err.message || "Error al vincularse a la mesa" }, { status: 500 });
  }
}
