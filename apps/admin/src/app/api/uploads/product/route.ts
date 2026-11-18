import { NextRequest, NextResponse } from "next/server";
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
 * Formato: `multipart/form-data` con `file` y `branchId`.
 * Respuesta: `{ url }` absoluta contra la app del cliente (es quien la muestra).
 *
 * Si el bucket no está configurado, responde 501 y el formulario sigue aceptando
 * URL manual o dataURL: nunca se rompe la creación de un producto.
 */
const APP_PUBLIC_URL =
  process.env.APP_PUBLIC_URL?.replace(/\/+$/, "") || "https://app.rabbitty.me";

export async function POST(req: NextRequest) {
  try {
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
