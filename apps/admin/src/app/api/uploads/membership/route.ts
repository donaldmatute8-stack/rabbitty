import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function uploadDir() {
  return process.env.UPLOAD_DIR?.trim() || "/data/validation/uploads";
}

/** Sube el arte de una membresía al volumen del admin y devuelve su URL pública. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (campo file)" }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Formato no válido. Usa PNG, JPG, WebP o GIF." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera 8 MB." }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const dir = path.join(uploadDir(), "memberships");
    await mkdir(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    const origin = req.nextUrl.origin;
    return NextResponse.json({
      success: true,
      url: `${origin}/api/uploads/membership/${filename}`,
      filename,
    });
  } catch (err) {
    console.error("[uploads] membership error:", err);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}
