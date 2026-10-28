import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import {
  isGodAdminIdentity,
  verifyGodAdminTotp,
  verifyGod2faCookieValue,
  godAdminTotpConfigured,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
  check2faRateLimit,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

function readGod2faCookie(req: NextRequest): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("god2fa="))
    ?.slice(7);
}

// GET /api/auth/2fa/verify → estado para la UI (¿requiere 2FA? ¿ya verificado?)
export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";
  const required = isGodAdminIdentity(email, name);
  const verified = required ? verifyGod2faCookieValue(readGod2faCookie(req)) : false;
  return NextResponse.json({ required, verified, totpConfigured: godAdminTotpConfigured() });
}

// POST /api/auth/2fa/verify  { code } → valida TOTP y emite cookie firmada 12h
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";

  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!check2faRateLimit(`2fa:${ip}:${email}`)) {
    return NextResponse.json({ success: false, error: "Demasiados intentos. Espera 5 minutos." }, { status: 429 });
  }

  if (!godAdminTotpConfigured()) {
    return NextResponse.json(
      { success: false, error: "GOD_ADMIN_TOTP_SECRET no configurado en el servidor." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const code = String(body?.code || "");
    let ok = verifyGodAdminTotp(code);

    // ── Fallback: TOTP por-usuario (sistema DB, users.totpSecret encriptado) ──
    if (!ok && session?.user?.email) {
      try {
        const { getCoreDb } = await import("@rabbitty/api/db");
        const { users } = await import("@rabbitty/database-core");
        const { eq } = await import("drizzle-orm");
        const { decryptText } = await import("@rabbitty/api/services/crypto");
        const { verify: otplibVerify } = await import("otplib");
        const coreDb = getCoreDb();
        const [coreUser] = await coreDb
          .select({ id: users.id, totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
          .from(users)
          .where(eq(users.email, session.user.email.trim().toLowerCase()))
          .limit(1);
        if (coreUser?.totpSecret && coreUser.totpEnabled) {
          const result = await otplibVerify({ token: code, secret: decryptText(coreUser.totpSecret) });
          ok = Boolean(result?.valid);
        }
      } catch {
        // fallback silencioso — env secret es la vía principal
      }
    }

    if (!ok) {
      return NextResponse.json({ success: false, error: "Código incorrecto o expirado." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
    path: "/",
  });
  return res;
}
