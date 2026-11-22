import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@rabbitty/auth";
import {
  isGodAdminIdentity,
  verifyGod2faCookieValue,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

/**
 * ── Token de dispositivo para desbloqueo biométrico nativo ──
 *
 * Contexto: el WebView de la app de iPad en Mac NO implementa WebAuthn
 * (`window.PublicKeyCredential` no existe), así que las passkeys no pueden
 * usarse ahí. El puente nativo (RabbittyBiometrics) pide Touch ID/Face ID con
 * LocalAuthentication y guarda este token en el Keychain.
 *
 * Flujo:
 *   1. Tras verificar el TOTP, la app llama `action: "enroll"` (ya hay cookie
 *      god2fa válida) y guarda el token en el Keychain.
 *   2. Al abrir la app, si hay token: pide biometría, lo lee y llama
 *      `action: "redeem"` para obtener la cookie god2fa sin teclear el código.
 *
 * Seguridad:
 *   · Token firmado con HMAC (secreto del servidor), ligado al correo y con
 *     caducidad (30 días). No se guarda en la base.
 *   · Solo se emite con la cookie god2fa vigente (es decir, tras un TOTP real).
 *   · Rotar el secreto invalida todos los tokens de todos los dispositivos.
 *   · La cookie emitida dura 12 h, igual que el flujo TOTP.
 */
const DEVICE_TTL_DAYS = 30;
const MAX_AGE_SECONDS = 12 * 60 * 60;

function secret(): string {
  return String(process.env.GOD_DEVICE_SECRET || process.env.RABBITTY_API_SECRET || "");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
}

function issueDeviceToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), exp: Date.now() + DEVICE_TTL_DAYS * 86400_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyDeviceToken(token: string, email: string): boolean {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (String(data?.e || "").toLowerCase() !== email.toLowerCase()) return false;
    if (!Number.isFinite(data?.exp) || Number(data.exp) < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function readCookie(req: NextRequest): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOD_2FA_COOKIE}=`))
    ?.slice(GOD_2FA_COOKIE.length + 1);
}

function cookieResponse(body: Record<string, unknown>) {
  const res = NextResponse.json(body);
  res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = (session?.user?.email || "").trim().toLowerCase();
  const name = session?.user?.name || "";

  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  if (!secret()) {
    return NextResponse.json(
      { success: false, error: "Falta GOD_DEVICE_SECRET o RABBITTY_API_SECRET en el servidor." },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }

  const action = String(body?.action || "");

  // ── Enrolar: requiere haber pasado el TOTP en esta sesión ──
  if (action === "enroll") {
    if (!verifyGod2faCookieValue(readCookie(req))) {
      return NextResponse.json(
        { success: false, error: "Verifica tu código primero" },
        { status: 401 },
      );
    }
    const token = issueDeviceToken(email);
    return NextResponse.json({ success: true, token, expiresInDays: DEVICE_TTL_DAYS });
  }

  // ── Canjear: el token vale por un TOTP ya hecho; la biometría la pone el SO ──
  if (action === "redeem") {
    const token = String(body?.token || "");
    if (!verifyDeviceToken(token, email)) {
      return NextResponse.json({ success: false, error: "Token inválido o expirado" }, { status: 401 });
    }
    return cookieResponse({ success: true });
  }

  return NextResponse.json({ success: false, error: "Acción no soportada" }, { status: 400 });
}
