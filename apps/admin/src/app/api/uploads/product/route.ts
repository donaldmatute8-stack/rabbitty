import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@rabbitty/auth";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { branches, restaurants, staff } from "@rabbitty/database-restaurant/schema";
import { ownedBusinesses, users } from "@rabbitty/database-core/schema";
import { isGodAdminIdentity } from "@rabbitty/api/services/god2fa";
import {
  buildProductImageKey,
  IMAGE_TYPES,
  isMediaStorageConfigured,
  MAX_MEDIA_BYTES,
  uploadObject,
} from "@rabbitty/api/services/mediaStorage";

export const runtime = "nodejs";

/**
 * ── POST /api/uploads/product ── foto de platillo/producto ─────────────────
 *
 * Sustituye al dataURL que se guardaba en `menu_items.imageUrl` (tope 300 KB y
 * base64 dentro de Postgres). El binario va al bucket y en la columna queda una
 * URL.
 *
 * **Requiere sesión y pertenencia**: el admin no tiene middleware, así que antes
 * este endpoint era un basurero público (cualquiera subía archivos a nuestro
 * bucket eligiendo el `branchId` del prefijo). Ahora se valida sesión + que la
 * sucursal sea del negocio del usuario (dueño o staff activo), o God.
 *
 * Formato: `multipart/form-data` con `file` y `branchId`.
 * Respuesta: `{ url }` absoluta contra la app del cliente (es quien la muestra).
 *
 * Si el bucket no está configurado, responde 501 y el formulario sigue aceptando
 * URL manual o dataURL: nunca se rompe la creación de un producto.
 */
const APP_PUBLIC_URL =
  process.env.APP_PUBLIC_URL?.replace(/\/+$/, "") || "https://app.rabbitty.me";

/** ¿El usuario de la sesión puede tocar esta sucursal? */
async function canUseBranch(email: string | null | undefined, branchId: string): Promise<boolean> {
  if (!email) return false;
  if (isGodAdminIdentity(email, null)) return true;

  const restaurantDb = getRestaurantDb();
  const coreDb = getCoreDb();

  // Staff activo de la sucursal (cajero, cocina, manager…)
  const [staffRow] = await restaurantDb
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.email, email), eq(staff.branchId, branchId), eq(staff.isActive, true)))
    .limit(1);
  if (staffRow) return true;

  // Dueño del negocio dueño de la sucursal
  const [branchRow] = await restaurantDb
    .select({ restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!branchRow?.restaurantId) return false;

  const [restRow] = await restaurantDb
    .select({ businessId: restaurants.businessId })
    .from(restaurants)
    .where(eq(restaurants.id, branchRow.restaurantId))
    .limit(1);
  if (!restRow?.businessId) return false;

  const [coreUser] = await coreDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!coreUser?.id) return false;

  const [owned] = await coreDb
    .select({ id: ownedBusinesses.id })
    .from(ownedBusinesses)
    .where(
      and(eq(ownedBusinesses.id, restRow.businessId), eq(ownedBusinesses.ownerId, coreUser.id)),
    )
    .limit(1);
  return Boolean(owned);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!isMediaStorageConfigured()) {
      return NextResponse.json(
        { error: "El almacenamiento de imágenes no está configurado en este entorno." },
        { status: 501 },
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const branchId = String(form?.get("branchId") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9-]{4,64}$/.test(branchId)) {
      return NextResponse.json({ error: "Sucursal inválida" }, { status: 400 });
    }

    // Aislamiento entre tenants: no se escribe bajo el prefijo de otra sucursal.
    if (!(await canUseBranch(session.user.email, branchId))) {
      return NextResponse.json({ error: "Sin permiso sobre esa sucursal" }, { status: 403 });
    }

    const ext = IMAGE_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Formato no permitido (usa JPG, PNG o WebP)" },
        { status: 415 },
      );
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ error: "La imagen supera 5 MB" }, { status: 413 });
    }

    const key = buildProductImageKey(branchId, file.type);
    await uploadObject(key, await file.arrayBuffer(), file.type);

    return NextResponse.json({
      success: true,
      key,
      url: `${APP_PUBLIC_URL}/api/media/product/${key}`,
    });
  } catch (error) {
    console.error("[UPLOAD_PRODUCT]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 500 });
  }
}
