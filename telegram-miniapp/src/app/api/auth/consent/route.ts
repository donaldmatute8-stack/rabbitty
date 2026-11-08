import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { getClientIp } from "@/lib/otp";

/**
 * Registra la aceptación de Términos y Aviso de Privacidad del Rabbitter.
 * Se usa en onboarding (nuevo usuario) y en el gate de re-consentimiento
 * para usuarios existentes.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.acceptedTerms !== true) {
    return NextResponse.json({ error: "Debes aceptar los términos" }, { status: 400 });
  }

  const version =
    typeof body?.consentVersion === "string" ? body.consentVersion.slice(0, 40) : null;
  const now = new Date();

  await db
    .update(users)
    .set({
      termsAcceptedAt: now,
      termsVersion: version,
      privacyAcceptedAt: now,
      privacyVersion: version,
      consentIp: getClientIp(req),
      consentUserAgent: req.headers.get("user-agent") || null,
    })
    .where(eq(users.id, auth.id));

  return NextResponse.json({
    success: true,
    termsAcceptedAt: now.toISOString(),
    termsVersion: version,
  });
}
