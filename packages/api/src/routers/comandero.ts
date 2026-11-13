/**
 * ── Comandero: chequeo y operación (ADR-025) ───────────────────────────────
 *
 * El mesero entra a `/comandero` en su celular o en la tablet del restaurante.
 * Para operar necesita dos cosas:
 *
 *   1. **Presencia**: escanear el código que muestra el admin (rota cada 60 s).
 *   2. **Identidad**: su PIN de empleado.
 *
 * Eso abre su turno (`staff_shifts`) y la sesión de operador (el mismo token
 * que usa el POS). Al cerrar el comandero se registra la salida.
 *
 * El comandero NO cobra: abre la cuenta y la caja la cierra.
 */

import crypto from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, posProcedure, protectedProcedure } from "../trpc";
import { posOperatorSessions } from "@rabbitty/database-core/schema";
import {
  menuItems,
  orders,
  orderItems,
  staff as staffTable,
  staffShifts,
  stations,
  tables,
} from "@rabbitty/database-restaurant/schema";
import { verifyPin } from "../services/crypto";
import { assertPinNotLocked, clearPinFails, registerPinFail } from "../services/cashShift";
import { currentPresenceCode, verifyPresenceCode } from "../services/presenceCode";
import { enqueueRealtimeEvent, stationChannel } from "../services/realtimeOutbox";
import { resolveBusinessIdFromBranch } from "../services/businessContext";

const SHIFT_HOURS = 12;
const newToken = () => crypto.randomBytes(32).toString("hex");

/** Estados de orden que siguen abiertas (se pueden editar). */
const OPEN_STATUSES = ["PENDING", "PENDING_PAYMENT", "CASH_PAYMENT_REQUESTED"];

function assertTerminal(ctx: any) {
  const terminalId = ctx.posAuth?.terminalId;
  if (!terminalId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Este dispositivo no está vinculado. Pide que lo enlacen en Ajustes → Terminales.",
    });
  }
  return String(terminalId);
}

export const comanderoRouter = router({
  /**
   * Código de presencia para el admin. Rota cada minuto; el QR solo lleva esto.
   */
  presenceCode: protectedProcedure.query(async ({ ctx }) => {
    const { code, expiresAt, windowSeconds } = currentPresenceCode(ctx.branchId);
    return { code, expiresAt, windowSeconds };
  }),

  /** Estado del chequeo en este dispositivo. */
  status: posProcedure.query(async ({ ctx }) => {
    let shift = null;
    if (ctx.posOperator?.staffId) {
      const [row] = await ctx.restaurantDb
        .select()
        .from(staffShifts)
        .where(
          and(
            eq(staffShifts.staffId, ctx.posOperator.staffId),
            eq(staffShifts.status, "ACTIVE"),
          ),
        )
        .orderBy(desc(staffShifts.checkIn))
        .limit(1);
      shift = row ?? null;
    }
    return {
      checkedIn: Boolean(ctx.posOperator?.staffId && shift),
      operator: ctx.posOperator
        ? { staffId: ctx.posOperator.staffId, name: ctx.posOperator.name, role: ctx.posOperator.role }
        : null,
      shift: shift ? { id: shift.id, checkIn: shift.checkIn, status: shift.status } : null,
      terminal: ctx.posAuth?.method === "terminal"
        ? { id: ctx.posAuth.terminalId, name: ctx.posAuth.terminalName, branchId: ctx.posAuth.branchId }
        : null,
    };
  }),

  /**
   * Chequeo: código de presencia + PIN. Abre turno y sesión de operador.
   * Idempotente: si ya hay turno en esta terminal, devuelve el mismo operador.
   */
  checkIn: posProcedure
    .input(z.object({ code: z.string().min(4).max(20), pin: z.string().length(4) }))
    .mutation(async ({ ctx, input }) => {
      const terminalId = assertTerminal(ctx);

      if (!verifyPresenceCode(ctx.branchId, input.code)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El código de la sucursal venció. Escanea el QR otra vez.",
        });
      }

      const scope = `pin:pos-operator:${ctx.branchId}`;
      await assertPinNotLocked(ctx.restaurantDb, scope);

      const list = await ctx.restaurantDb
        .select()
        .from(staffTable)
        .where(and(eq(staffTable.branchId, ctx.branchId), eq(staffTable.isActive, true)));

      const match = list.find((s: any) => s.pinCode && verifyPin(input.pin, s.pinCode));
      if (!match) {
        await registerPinFail(ctx.restaurantDb, scope);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "PIN incorrecto" });
      }
      await clearPinFails(ctx.restaurantDb, scope);

      // Una sola sesión viva por terminal (igual que el POS).
      await ctx.coreDb
        .update(posOperatorSessions)
        .set({ endedAt: new Date() })
        .where(
          and(eq(posOperatorSessions.terminalId, terminalId), isNull(posOperatorSessions.endedAt)),
        );

      const token = newToken();
      const expiresAt = new Date(Date.now() + SHIFT_HOURS * 3600_000);
      await ctx.coreDb.insert(posOperatorSessions).values({
        terminalId,
        staffId: match.id,
        token,
        expiresAt,
      });

      // Turno del reloj checador: si ya tenía uno abierto, se reutiliza.
      const [openShift] = await ctx.restaurantDb
        .select()
        .from(staffShifts)
        .where(and(eq(staffShifts.staffId, match.id), eq(staffShifts.status, "ACTIVE")))
        .limit(1);

      const shift =
        openShift ??
        (
          await ctx.restaurantDb
            .insert(staffShifts)
            .values({ staffId: match.id, branchId: ctx.branchId, status: "ACTIVE" })
            .returning()
        )[0]!;

      return {
        token,
        expiresAt,
        operator: { staffId: match.id, name: match.name, role: match.role },
        shift: { id: shift.id, checkIn: shift.checkIn },
        alreadyOpen: Boolean(openShift),
      };
    }),

  /** Salida del turno (reloj checador) al cerrar el comandero. */
  checkOut: posProcedure.mutation(async ({ ctx }) => {
    if (!ctx.posOperator?.staffId) return { success: false, reason: "SIN_TURNO" as const };

    const [shift] = await ctx.restaurantDb
      .select()
      .from(staffShifts)
      .where(and(eq(staffShifts.staffId, ctx.posOperator.staffId), eq(staffShifts.status, "ACTIVE")))
      .limit(1);

    if (shift) {
      await ctx.restaurantDb
        .update(staffShifts)
        .set({ status: "FINISHED", checkOut: new Date() })
        .where(eq(staffShifts.id, shift.id));
    }

    if (ctx.posAuth?.terminalId) {
      await ctx.coreDb
        .update(posOperatorSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(posOperatorSessions.terminalId, String(ctx.posAuth.terminalId)),
            isNull(posOperatorSessions.endedAt),
          ),
        );
    }

    return { success: true };
  }),

  /**
   * ── Notificador de "listo" (ADR-025 D9) ─────────────────────────────────
   *
   * Ítems que cocina/barra ya marcaron como listos, de las cuentas de ESTE
   * mesero. El comandero lo consulta cada pocos segundos y avisa con sonido y
   * vibración: producto, estación, mesa y a quién va.
   */
  readyFeed: posProcedure.query(async ({ ctx }) => {
    const staffId = ctx.posOperator?.staffId;
    if (!staffId) return [];

    const rows = await ctx.restaurantDb
      .select({
        itemId: orderItems.id,
        orderId: orders.id,
        quantity: orderItems.quantity,
        name: menuItems.name,
        guestName: orderItems.guestName,
        allergies: orderItems.allergies,
        stationName: stations.name,
        tableNumber: tables.number,
        orderType: orders.orderType,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .leftJoin(tables, eq(tables.id, orders.tableId))
      .leftJoin(stations, eq(stations.id, orderItems.stationId))
      .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
      .where(
        and(
          eq(orders.branchId, ctx.branchId),
          eq(orders.staffId, staffId),
          eq(orderItems.status, "READY"),
        ),
      )
      .limit(20);

    return rows;
  }),

  /**
   * Tablero: mesas con su cuenta abierta (para el mesero).
   */
  board: posProcedure.query(async ({ ctx }) => {
    const tablesList = await ctx.restaurantDb
      .select({
        id: tables.id,
        number: tables.number,
        capacity: tables.capacity,
        location: tables.location,
      })
      .from(tables)
      .where(and(eq(tables.branchId, ctx.branchId), eq(tables.isActive, true)))
      .orderBy(tables.number);

    const openOrders = await ctx.restaurantDb
      .select({
        id: orders.id,
        tableId: orders.tableId,
        orderType: orders.orderType,
        status: orders.status,
        total: orders.total,
        customerName: orders.customerName,
        createdAt: orders.createdAt,
        items: sql<number>`(SELECT COUNT(*) FROM order_items oi WHERE oi."orderId" = ${orders.id})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.branchId, ctx.branchId),
          eq(orders.billOnly, false),
          inArray(orders.status, OPEN_STATUSES),
        ),
      );

    const byTable = new Map<string, (typeof openOrders)[number]>();
    for (const order of openOrders) {
      if (order.tableId) byTable.set(order.tableId, order);
    }

    return {
      tables: tablesList.map((t: any) => ({
        ...t,
        order: byTable.get(t.id)
          ? {
              id: byTable.get(t.id)!.id,
              total: Number(byTable.get(t.id)!.total),
              items: Number(byTable.get(t.id)!.items),
              status: byTable.get(t.id)!.status,
            }
          : null,
      })),
      counterOrders: openOrders.filter((o: any) => !o.tableId && o.orderType !== "DINE_IN"),
    };
  }),

  /**
   * Abre (o reutiliza) la cuenta de una mesa o de mostrador.
   * Nunca crea una segunda cuenta para la misma mesa abierta.
   */
  openOrder: posProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        guestName: z.string().trim().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.tableId) {
        const [table] = await ctx.restaurantDb
          .select({ id: tables.id })
          .from(tables)
          .where(and(eq(tables.id, input.tableId), eq(tables.branchId, ctx.branchId)))
          .limit(1);
        if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa no encontrada" });

        const [existing] = await ctx.restaurantDb
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.tableId, input.tableId),
              eq(orders.branchId, ctx.branchId),
              eq(orders.billOnly, false),
              inArray(orders.status, OPEN_STATUSES),
            ),
          )
          .limit(1);
        if (existing) return { orderId: existing.id, created: false };
      }

      const [created] = await ctx.restaurantDb
        .insert(orders)
        .values({
          branchId: ctx.branchId,
          tableId: input.tableId ?? null,
          orderType: input.orderType,
          status: "PENDING",
          subtotal: 0,
          tax: 0,
          total: 0,
          staffId: ctx.posOperator?.staffId ?? null,
          customerName: input.guestName ?? null,
        })
        .returning({ id: orders.id });

      return { orderId: created!.id, created: true };
    }),

  /**
   * Envía la tanda a cocina/barra: marca los ítems retenidos y publica el
   * aviso a la estación de cada uno. Sin esto, lo agregado queda "en captura".
   */
  sendRound: posProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId, tableId: orders.tableId })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta no encontrada" });

      const pending = await ctx.restaurantDb
        .select({
          id: orderItems.id,
          stationId: orderItems.stationId,
          status: orderItems.status,
        })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.sentToStationAt)));

      if (pending.length === 0) return { sent: 0 };

      await ctx.restaurantDb
        .update(orderItems)
        .set({ sentToStationAt: new Date() })
        .where(
          and(eq(orderItems.orderId, order.id), isNull(orderItems.sentToStationAt)),
        );

      const bizId = await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId);
      for (const item of pending) {
        if (!item.stationId) continue;
        await enqueueRealtimeEvent(ctx.restaurantDb, {
          businessId: bizId,
          branchId: ctx.branchId,
          channel: stationChannel(bizId, ctx.branchId, item.stationId),
          eventType: "order.item.added",
          payload: {
            orderId: order.id,
            itemId: item.id,
            stationId: item.stationId,
            status: item.status,
          },
          eventId: `round-${item.id}`,
        });
      }

      return { sent: pending.length };
    }),
});
