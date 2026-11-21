import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * ── /.well-known/apple-app-site-association ──
 * Apple exige este archivo en el MISMO host que el RP para que las passkeys
 * (Touch ID / Face ID) funcionen DENTRO del WebView de la app nativa. Sin él,
 * `navigator.credentials` no existe en la app de Mac/iPad (solo en Safari).
 *
 * RP_ID = rabbitty.me (Railway). Los hosts asociados viven en
 * `apps/admin/ios/App/App/App.entitlements`:
 *   webcredentials:rabbitty.me, webcredentials:admin.rabbitty.me
 *
 * Este JSON debe servirse SIN redirects desde https://rabbitty.me/.well-known/…
 * (en admin.rabbitty.me ya lo sirve esta ruta).
 */
const APP_SITE_ASSOCIATION = {
  webcredentials: {
    apps: [
      // App nativa del POS / admin (la que usa WebAuthn dentro del WebView).
      "FW97275K5X.com.rabbitty.pos",
    ],
  },
};

export async function GET() {
  return new NextResponse(JSON.stringify(APP_SITE_ASSOCIATION), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
