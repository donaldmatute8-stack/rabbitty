import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { verificationTokens, users, ownedBusinesses } from "@rabbitty/database-core";
import { isGodAdminIdentity } from "@rabbitty/api/services/god2fa";
import { eq, or, sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Solo pueden pedir código:
 *  - el God Admin (allowlist),
 *  - usuarios ADMIN/AFFILIATE (dueños de tenant),
 *  - dueños de un negocio.
 * Cualquier otro correo/teléfono recibe una respuesta genérica sin token ni envío.
 */
async function isAllowedAdminIdentity(db: any, email: string, phone: string | null): Promise<boolean> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (cleanEmail && isGodAdminIdentity(cleanEmail)) return true;

  let user: { id: string; role: string | null } | undefined;
  if (cleanEmail && !cleanEmail.endsWith("@phone.rabbitty.me")) {
    [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);
  }
  if (!user && phone) {
    const digits = phone.replace(/\D/g, "").slice(-10);
    [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`regexp_replace(${users.phoneNumber}, '\D', '', 'g') LIKE ${'%' + digits}`)
      .limit(1);
  }
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "AFFILIATE") return true;

  const [owner] = await db
    .select({ id: ownedBusinesses.id })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.ownerId, user.id))
    .limit(1);
  return Boolean(owner);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = (body?.input || body?.email || "").trim();

    if (!rawInput) {
      return NextResponse.json({ error: "Ingresa un correo o número celular válido" }, { status: 400 });
    }

    const db = getCoreDb();
    let email = "";
    let phone: string | null = null;
    let mode: "email" | "phone" = "email";

    const isEmail = rawInput.includes("@");

    if (isEmail) {
      email = rawInput.toLowerCase();
      mode = "email";
    } else {
      mode = "phone";
      // Normalizar número telefónico
      const digitsOnly = rawInput.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        return NextResponse.json({ error: "El número celular debe tener al menos 8 dígitos" }, { status: 400 });
      }

      phone = rawInput.startsWith("+") ? rawInput : `+${digitsOnly}`;

      // Buscar si el usuario existe por teléfono o los últimos 10 dígitos
      const last10 = digitsOnly.slice(-10);
      const [matchedUser] = await db
        .select({ id: users.id, email: users.email, phoneNumber: users.phoneNumber })
        .from(users)
        .where(
          sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') LIKE ${'%' + last10}`
        )
        .limit(1);

      if (matchedUser && matchedUser.email) {
        email = matchedUser.email;
      } else {
        // Generar identificador compatible para usuario telefónico
        email = `${digitsOnly}@phone.rabbitty.me`;
      }
    }

    const cleanInput = rawInput.toLowerCase();
    const isReviewerDemo =
      cleanInput === "pos-reviewer@rabbitty.me" ||
      cleanInput === "pos-reviewer" ||
      cleanInput === "tester@rabbitty.me" ||
      cleanInput === "tester";

    if (isReviewerDemo) {
      email = cleanInput.includes("@") ? cleanInput : `${cleanInput}@rabbitty.me`;
    }

    const allowed = await isAllowedAdminIdentity(db, email, phone);
    if (!allowed) {
      // Respuesta genérica: no revelamos si la cuenta existe y no enviamos nada.
      console.warn("[AUTH OTP] Identidad no autorizada para el panel:", email);
      return NextResponse.json({
        success: true,
        mode,
        target: rawInput,
        message: "Si la cuenta está autorizada, recibirás un código.",
      });
    }

    // 1. Generar código OTP (123456 fijo para el revisor de Apple, aleatorio para usuarios reales)
    const otpCode = isReviewerDemo ? "123456" : crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + (isReviewerDemo ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000)); // 24h para demo

    // 2. Limpiar tokens anteriores para este identificador/email
    await db.delete(verificationTokens).where(
      or(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.identifier, rawInput),
        phone ? eq(verificationTokens.identifier, phone) : sql`false`,
        // La PK de verificationTokens es el token: al reutilizar 123456 (demo
        // reviewer) hay que borrar cualquier fila previa con ese mismo código.
        eq(verificationTokens.token, otpCode)
      )
    );

    // 3. Insertar el token numérico en verificationTokens
    // Insertamos tanto con el email como con el input crudo/teléfono para garantizar match
    await db.insert(verificationTokens).values({
      identifier: email,
      token: otpCode,
      expires,
    });

    if (phone && phone !== email) {
      try {
        await db.insert(verificationTokens).values({
          identifier: phone,
          token: otpCode,
          expires,
        });
      } catch {
        // Ignorar si duplicado
      }
    }

    console.log(`[AUTH OTP GENERATED] Mode: ${mode} | Destino autorizado: ${email}`);

    // 4. Intentar enviar correo con Resend si hay API key configurada
    const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;
    if (apiKey && email.includes("@") && !email.endsWith("@phone.rabbitty.me")) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.AUTH_RESEND_FROM || "Rabbitty Team <hola@rabbitty.me>",
            to: email,
            subject: `🔑 ${otpCode} es tu código de acceso Rabbitty Admin`,
            html: `
              <div style="background-color: #050508; color: #ffffff; padding: 40px; font-family: sans-serif; text-align: center;">
                <h1 style="color: #ec4899;">Rabbitty Admin</h1>
                <p>Tu código de acceso de 6 dígitos es:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 12px; display: inline-block; margin: 20px 0; color: #f43f5e;">
                  ${otpCode}
                </div>
                <p style="color: #a1a1aa; font-size: 13px;">Válido durante 15 minutos.</p>
              </div>
            `,
          }),
        });
      } catch (err) {
        console.warn("[AUTH OTP] Resend dispatch warning:", err);
      }
    }

    // 5. Retornar información para la UI
    // En desarrollo o testing, incluimos el otpCode en la respuesta para visibilidad inmediata si no hay gateway SMS
    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json({
      success: true,
      mode,
      target: rawInput,
      resolvedEmail: email,
      otpCode: isDev ? otpCode : undefined,
      message: mode === "phone"
        ? `Código generado para ${rawInput}`
        : `Enviamos un código de 6 dígitos a ${email}`,
    });
  } catch (error) {
    console.error("[AUTH OTP ERROR]:", error);
    return NextResponse.json({ error: "Error interno al generar código" }, { status: 500 });
  }
}
