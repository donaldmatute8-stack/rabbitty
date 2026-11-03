import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * ── /.well-known/apple-developer-domain-association.txt ── Apple Pay domain
 * verification (H24). Neobligatoria sirve desde env APPLE_PAY_DOMAIN_TOKEN:
 * Marco pega en Vercel/Railway el TOKEN QUE GENRA STRIPE DASHBOARD 
 * (Payments → Apple Pay → Add domain → download file) y este route lo sirve.
 * Verificación única sin commits ni files en repos.
 */
export async function GET(req: NextRequest) {
  const token = String(process.env.APPLE_PAY_DOMAIN_TOKEN || "");
  if (!token) {
    return new NextResponse("APPLE_PAY_DOMAIN_TOKEN no configurado", { status: 404 });
  }
  return new NextResponse(token, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
