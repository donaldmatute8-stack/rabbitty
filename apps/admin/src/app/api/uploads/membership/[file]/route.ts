import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function uploadDir() {
  return process.env.UPLOAD_DIR?.trim() || "/data/validation/uploads";
}

/** Sirve el arte subido desde el volumen del admin. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  try {
    const { file } = await params;
    const safe = path.basename(file);
    const ext = safe.split(".").pop()?.toLowerCase() ?? "";
    if (!TYPES[ext]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const buf = await readFile(path.join(uploadDir(), "memberships", safe));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
