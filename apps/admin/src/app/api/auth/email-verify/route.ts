import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { verificationTokens } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";

const NEON_URL =
  process.env.CORE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "postgresql://neondb_owner:npg_ltE02YwbyAaP@ep-delicate-violet-ap6izh0k-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function ensureUser(email: string): Promise<{ id: string; email: string }> {
  const { default: pg } = await import("pg");
  const { Pool } = pg;
  const pool = new Pool({ connectionString: NEON_URL, max: 2 });

  try {
    // Upsert user
    await pool.query(
      `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified")
       VALUES (gen_random_uuid()::text, $1, NOW())
       ON CONFLICT ("email") DO UPDATE SET "emailVerified" = NOW()`,
      [email]
    );
    const res = await pool.query(`SELECT "id", "email" FROM "adminAuthUsers" WHERE "email" = $1`, [email]);
    return res.rows[0];
  } finally {
    await pool.end();
  }
}

/**
 * POST /api/auth/email-verify
 *
 * Verifica un magic-link token directamente en la DB y emite una sesión
 * JWT sin depender de cookies CSRF de NextAuth.
 *
 * Fix cross-browser: el token se valida server-side independientemente
 * del browser que inició el flujo de login.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, email } = await req.json();

    if (!token || !email) {
      return NextResponse.json({ error: "Parámetros incompletos." }, { status: 400 });
    }

    const db = getCoreDb();

    // 1. Buscar token en DB
    const [stored] = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token));

    if (!stored) {
      console.warn("[email-verify] Token no encontrado:", email);
      return NextResponse.json(
        { error: "El enlace ya fue utilizado o ha expirado. Solicita uno nuevo." },
        { status: 401 }
      );
    }

    // 2. Verificar expiración
    if (new Date(stored.expires) < new Date()) {
      await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
      return NextResponse.json(
        { error: "El enlace expiró. Solicita uno nuevo desde el login." },
        { status: 401 }
      );
    }

    // 3. Verificar que el email coincida
    if (stored.identifier.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "El enlace no corresponde a este email." }, { status: 401 });
    }

    // 4. Consumir token (single use)
    await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

    // 5. Upsert usuario en adminAuthUsers
    const user = await ensureUser(stored.identifier);

    // 6. Emitir JWT session token
    const secret =
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "rabbitty-admin-secret-key-32chars-minimum-length";

    const now = Math.floor(Date.now() / 1000);
    const sessionToken = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.email,
        iat: now,
        exp: now + 30 * 24 * 60 * 60, // 30 days
        jti: crypto.randomUUID(),
      },
      secret,
      salt: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
    });

    // 7. Setear la cookie de sesión en la respuesta
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction ? "__Secure-authjs.session-token" : "authjs.session-token";

    const response = NextResponse.json({ ok: true, email: user.email });
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    console.log("[email-verify] ✅ Sesión creada para:", user.email);
    return response;
  } catch (err: any) {
    console.error("[email-verify] Error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
