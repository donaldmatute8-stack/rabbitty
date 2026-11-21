import { NextRequest, NextResponse } from "next/server";
import { isAllowedQrTarget, qrPng } from "@rabbitty/api/services/qr";

export const runtime = "nodejs";

/**
 * ── /api/pos/qr?data=<url> ──
 * PNG del QR que se imprime en el ticket térmico. Same-origin a propósito:
 * el POS lo rasteriza desde la misma app (sin CORS ni servicios externos).
 * Solo acepta enlaces de Rabbitty.
 */
export async function GET(req: NextRequest) {
  const data = String(new URL(req.url).searchParams.get("data") || "").trim();
  if (!isAllowedQrTarget(data)) {
    return NextResponse.json({ success: false, error: "QR no permitido" }, { status: 400 });
  }

  try {
    const png = await qrPng(data, 240);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[POS_QR]", err);
    return NextResponse.json({ success: false, error: "No se pudo generar el QR" }, { status: 500 });
  }
}
