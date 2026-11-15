import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import {
  branches,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  restaurants,
} from "@rabbitty/database-restaurant/schema";
import { userPreferences } from "@rabbitty/database-core";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/preferences ── Agrega preferencias de consumo (Fase 0/15.2+)
 *
 * Lee pedidos de los últimos 180 días y calcula, por Rabbitter:
 *   · sus productos favoritos en cada negocio (frecuencia con decaimiento)
 *   · sus categorías favoritas (globales y por negocio)
 *
 * Es idempotente: recalcula y hace upsert. Nunca pisa una preferencia
 * explícita (`explicit = true`) que haya marcado el usuario.
 *
 * Auth: Bearer CRON_SECRET.
 */

/** Vida media del interés: lo de hace ~45 días pesa la mitad. */
const HALF_LIFE_DAYS = 45;
const WINDOW_DAYS = 180;
/** Umbrales para considerar "favorito" algo con señal suficiente. */
const PRODUCT_MIN_SCORE = 0.08;
const PRODUCT_MIN_SIGNALS = 2;
const CATEGORY_MIN_SCORE = 0.1;
const TOP_PRODUCTS = 5;
const TOP_CATEGORIES = 3;

function authorize(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "").trim();
  return Boolean(CRON_SECRET && auth === CRON_SECRET);
}

interface Agg {
  weight: number;
  signals: number;
  lastSeenAt: Date | null;
  label: string;
}

const keyOf = (...parts: (string | null)[]) => parts.map((p) => p ?? "global").join("|");

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const restaurantDb = getRestaurantDb();
    const coreDb = getCoreDb();
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

    const rows = await restaurantDb
      .select({
        userId: orders.customerId,
        businessId: restaurants.businessId,
        productId: menuItems.id,
        productName: menuItems.name,
        categoryId: menuCategories.id,
        categoryName: menuCategories.name,
        quantity: orderItems.quantity,
        orderedAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(branches, eq(branches.id, orders.branchId))
      .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
      .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
      .where(
        and(
          isNotNull(orders.customerId),
          gte(orders.createdAt, since),
          eq(orders.billOnly, false),
        ),
      );

    const now = Date.now();

    const productAgg = new Map<string, Agg>();
    // Franja horaria del producto (para "tu café de las 8:30").
    const productHours = new Map<string, { morning: number; afternoon: number; evening: number; night: number }>();
    const hourFmt = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", hour12: false });
    const categoryAgg = new Map<string, Agg>();
    const globalCategoryAgg = new Map<string, Agg>();
    const businessTotals = new Map<string, number>();
    const globalTotals = new Map<string, number>();

    const bump = (map: Map<string, Agg>, key: string, label: string, weight: number, at: Date | null) => {
      const prev = map.get(key) ?? { weight: 0, signals: 0, lastSeenAt: null, label };
      map.set(key, {
        weight: prev.weight + weight,
        signals: prev.signals + 1,
        lastSeenAt: at && (!prev.lastSeenAt || at > prev.lastSeenAt) ? at : prev.lastSeenAt,
        label,
      });
    };

    for (const r of rows) {
      if (!r.userId || !r.businessId || !r.productId) continue;
      const at = r.orderedAt ? new Date(r.orderedAt) : null;
      const ageDays = at ? Math.max(0, (now - at.getTime()) / 86_400_000) : WINDOW_DAYS;
      // Frecuencia con decaimiento: un café diario pesa más que un postre de hace 5 meses.
      const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS) * Math.max(1, Number(r.quantity ?? 1));

      const prodKey = keyOf(r.userId, r.businessId, "PRODUCT", r.productId);
      bump(productAgg, prodKey, r.productName ?? "Producto", weight, at);

      if (at) {
        const h = Number(hourFmt.format(at)) % 24;
        const hist = productHours.get(prodKey) ?? { morning: 0, afternoon: 0, evening: 0, night: 0 };
        if (h >= 6 && h < 12) hist.morning += 1;
        else if (h >= 12 && h < 18) hist.afternoon += 1;
        else if (h >= 18 && h < 24) hist.evening += 1;
        else hist.night += 1;
        productHours.set(prodKey, hist);
      }
      businessTotals.set(keyOf(r.userId, r.businessId), (businessTotals.get(keyOf(r.userId, r.businessId)) ?? 0) + weight);

      if (r.categoryId) {
        const catKey = keyOf(r.userId, r.businessId, "CATEGORY", r.categoryId);
        bump(categoryAgg, catKey, r.categoryName ?? "Categoría", weight, at);

        const gCatKey = keyOf(r.userId, "CATEGORY", r.categoryId);
        bump(globalCategoryAgg, gCatKey, r.categoryName ?? "Categoría", weight, at);
        globalTotals.set(r.userId, (globalTotals.get(r.userId) ?? 0) + weight);
      }
    }

    /** Upsert que respeta lo explícito. */
    const upsert = async (input: {
      userId: string;
      businessId: string | null;
      kind: "PRODUCT" | "CATEGORY" | "DAY_PART";
      refId: string;
      label: string;
      score: number;
      signals: number;
      lastSeenAt: Date | null;
    }) => {
      const where = input.businessId
        ? and(
            eq(userPreferences.userId, input.userId),
            eq(userPreferences.businessId, input.businessId),
            eq(userPreferences.kind, input.kind),
            eq(userPreferences.refId, input.refId),
          )
        : and(
            eq(userPreferences.userId, input.userId),
            isNull(userPreferences.businessId),
            eq(userPreferences.kind, input.kind),
            eq(userPreferences.refId, input.refId),
          );

      const [existing] = await coreDb
        .select({ id: userPreferences.id, explicit: userPreferences.explicit })
        .from(userPreferences)
        .where(where)
        .limit(1);

      if (existing) {
        if (existing.explicit) return "kept";
        await coreDb
          .update(userPreferences)
          .set({
            label: input.label,
            score: input.score,
            signalCount: input.signals,
            lastSeenAt: input.lastSeenAt,
            source: "ORDER",
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.id, existing.id));
        return "updated";
      }

      await coreDb.insert(userPreferences).values({
        userId: input.userId,
        businessId: input.businessId,
        kind: input.kind,
        refId: input.refId,
        label: input.label,
        score: input.score,
        signalCount: input.signals,
        lastSeenAt: input.lastSeenAt,
        source: "ORDER",
        explicit: false,
      });
      return "created";
    };

    let created = 0;
    let updated = 0;

    // Productos por negocio (top N con señal suficiente)
    const byBusinessUser = new Map<string, Array<{ key: string; agg: Agg }>>();
    for (const [key, agg] of productAgg) {
      const [userId, businessId] = key.split("|");
      const groupKey = `${userId}|${businessId}`;
      const list = byBusinessUser.get(groupKey) ?? [];
      list.push({ key, agg });
      byBusinessUser.set(groupKey, list);
    }

    for (const [groupKey, list] of byBusinessUser) {
      const [userId, businessId] = groupKey.split("|");
      if (!userId || !businessId) continue;
      const total = businessTotals.get(groupKey) ?? 0;
      if (total <= 0) continue;

      const top = list.sort((a, b) => b.agg.weight - a.agg.weight).slice(0, TOP_PRODUCTS);
      for (const item of top) {
        const score = item.agg.weight / total;
        if (score < PRODUCT_MIN_SCORE || item.agg.signals < PRODUCT_MIN_SIGNALS) continue;
        const refId = item.key.split("|")[3];
        if (!refId) continue;
        const res = await upsert({
          userId,
          businessId,
          kind: "PRODUCT",
          refId,
          label: item.agg.label,
          score: Math.round(score * 1000) / 1000,
          signals: item.agg.signals,
          lastSeenAt: item.agg.lastSeenAt,
        });
        if (res === "created") created += 1;
        else if (res === "updated") updated += 1;

        // Franja habitual del producto (una sola, la dominante)
        const hist = productHours.get(item.key);
        if (hist) {
          const buckets = [
            { key: "morning", label: "mañana" },
            { key: "afternoon", label: "tarde" },
            { key: "evening", label: "noche" },
            { key: "night", label: "madrugada" },
          ] as const;
          const total = hist.morning + hist.afternoon + hist.evening + hist.night;
          const top = [...buckets].sort((a, b) => hist[b.key] - hist[a.key])[0];
          if (total > 0 && top) {
            const dayRes = await upsert({
              userId,
              businessId,
              kind: "DAY_PART" as never,
              refId,
              label: top.label,
              score: Math.round((hist[top.key] / total) * 1000) / 1000,
              signals: hist[top.key],
              lastSeenAt: item.agg.lastSeenAt,
            });
            if (dayRes === "created") created += 1;
            else if (dayRes === "updated") updated += 1;
          }
        }
      }
    }

    // Categorías por negocio
    const catByBusinessUser = new Map<string, Array<{ key: string; agg: Agg }>>();
    for (const [key, agg] of categoryAgg) {
      const [userId, businessId] = key.split("|");
      const groupKey = `${userId}|${businessId}`;
      const list = catByBusinessUser.get(groupKey) ?? [];
      list.push({ key, agg });
      catByBusinessUser.set(groupKey, list);
    }
    for (const [groupKey, list] of catByBusinessUser) {
      const [userId, businessId] = groupKey.split("|");
      const total = businessTotals.get(groupKey) ?? 0;
      if (!userId || !businessId || total <= 0) continue;
      const top = list.sort((a, b) => b.agg.weight - a.agg.weight).slice(0, TOP_CATEGORIES);
      for (const item of top) {
        const score = item.agg.weight / total;
        if (score < CATEGORY_MIN_SCORE) continue;
        const refId = item.key.split("|")[3];
        if (!refId) continue;
        const res = await upsert({
          userId,
          businessId,
          kind: "CATEGORY",
          refId,
          label: item.agg.label,
          score: Math.round(score * 1000) / 1000,
          signals: item.agg.signals,
          lastSeenAt: item.agg.lastSeenAt,
        });
        if (res === "created") created += 1;
        else if (res === "updated") updated += 1;
      }
    }

    // Categorías globales
    const globalByUser = new Map<string, Array<{ key: string; agg: Agg }>>();
    for (const [key, agg] of globalCategoryAgg) {
      const userId = key.split("|")[0];
      if (!userId) continue;
      const list = globalByUser.get(userId) ?? [];
      list.push({ key, agg });
      globalByUser.set(userId, list);
    }
    for (const [userId, list] of globalByUser) {
      const total = globalTotals.get(userId) ?? 0;
      if (total <= 0) continue;
      const top = list.sort((a, b) => b.agg.weight - a.agg.weight).slice(0, TOP_PRODUCTS);
      for (const item of top) {
        const score = item.agg.weight / total;
        if (score < CATEGORY_MIN_SCORE) continue;
        const refId = item.key.split("|")[2];
        if (!refId) continue;
        const res = await upsert({
          userId,
          businessId: null,
          kind: "CATEGORY",
          refId,
          label: item.agg.label,
          score: Math.round(score * 1000) / 1000,
          signals: item.agg.signals,
          lastSeenAt: item.agg.lastSeenAt,
        });
        if (res === "created") created += 1;
        else if (res === "updated") updated += 1;
      }
    }

    return NextResponse.json({
      success: true,
      orders: rows.length,
      users: globalByUser.size,
      created,
      updated,
    });
  } catch (error) {
    console.error("[PREFERENCES_CRON]", error);
    return NextResponse.json({ success: false, error: "No se pudieron calcular las preferencias" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, hint: "POST para recalcular preferencias" });
}
