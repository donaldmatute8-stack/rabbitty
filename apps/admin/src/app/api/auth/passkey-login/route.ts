import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings, verificationTokens } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import {
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
  verifyPasskeySignature,
  b64urlDecode,
  b64urlEncode,
  type StoredPasskey,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

const challenges = new Map<string, { challenge: string; expiresAt: number }>();


/** Lee las passkeys del god admin desde systemSettings (el MISMO almacén que Card 1). */
async function loadPasskeys(): Promise<StoredPasskey[]> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, "god_admin_passkeys")).limit(1);
  if (!row?.value) return [];
  try { return JSON.parse(row.value) as StoredPasskey[]; } catch { return []; }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }); }

  const action = String(body.action || "");
  const rpId = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "admin.rabbitty.me").split(":")[0];

  // ── OPTIONS: genera el challenge desde las passkeys del god admin ──
  if (action === "options") {
    const passkeys = await loadPasskeys();
    if (passkeys.length === 0) {
      return NextResponse.json({ success: false, error: "Sin passkeys. Entra con OTP y registra en Configuración → Seguridad." }, { status: 404 });
    }
    const challenge = b64urlEncode(crypto.randomBytes(32));
    const loginId = crypto.randomBytes(16).toString("hex");
    // Challenge en memoria (single-instance Vercel — sobrevive hasta el próximo cold start)
    challenges.set(loginId, { challenge, expiresAt: Date.now() + 3 * 60 * 1000 });
    const toB64url = (b64s: string) => b64s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return NextResponse.json({ success: true, challenge, loginId, allowCredentialIds: passkeys.map(p => toB64url(p.credId)), rpId });
  }

  // ── VERIFY: verifica la firma contra la JWK almacenada y crea la sesión ──
  if (action === "verify") {
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.get") throw new Error("Tipo inválido");

      // Validar challenge (en memoria)
      const challengeEntry = challenges.get(String(body.loginId || ""));
      challenges.delete(String(body.loginId || ""));
      if (!challengeEntry || challengeEntry.expiresAt < Date.now()) throw new Error("Challenge expirado");
      if (challengeEntry.challenge !== clientData.challenge) throw new Error("Challenge no coincide");
      if (!clientData.origin.endsWith(rpId)) throw new Error("Origen no permitido");

      const authDataBuf = b64urlDecode(String(body.authenticatorData));
      const signature = b64urlDecode(String(body.signature));
      const rawCredId = String(body.credentialId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const toStdB64 = (u: string) => { const std = u.replace(/-/g, '+').replace(/_/g, '/'); return std + '='.repeat((4 - (std.length % 4)) % 4); };
      const presentedCredId = toStdB64(rawCredId);

      const db = getCoreDb();
      const passkeys = await loadPasskeys();
      const match = passkeys.find(p => toStdB64(p.credId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) === presentedCredId);
      if (!match) throw new Error("Passkey no registrada en este servidor");

      const ok = verifyPasskeySignature(match.publicKeyJwk, authDataBuf, clientDataJSON, signature);
      if (!ok) throw new Error("Firma inválida");

      // El god admin es el dueño de las passkeys en este almacén
      const email = "marco.munoz9@gmail.com";
      const pool = (await import("pg")).default.Pool;
      const pgPool = new pool({ connectionString: process.env.CORE_DATABASE_URL, max: 1 });
      await pgPool.query(
        `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified") VALUES (gen_random_uuid()::text, $1, NOW()) ON CONFLICT ("email") DO UPDATE SET "emailVerified" = NOW()`,
        [email]
      );
      const userRes = await pgPool.query(`SELECT "id", "email" FROM "adminAuthUsers" WHERE "email" = $1`, [email]);
      await pgPool.end();
      const adminUser = userRes.rows[0];
      if (!adminUser) throw new Error("No se pudo crear la sesión");

      // Crear verification token para el proveedor NextAuth email-token
      const loginToken = crypto.randomBytes(32).toString("hex");
      await db.insert(verificationTokens).values({
        identifier: email,
        token: loginToken,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      const res = NextResponse.json({ success: true, token: loginToken, email });
      // También setear la cookie god2fa (passkey login = 2FA verificado)
      res.cookies.set(GOD_2FA_COOKIE, (await import("@rabbitty/api/services/god2fa")).issueGod2faCookieValue(), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60, path: "/",
      });
      return res;
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Verificación fallida" }, { status: 401 });
    }
  }

  return NextResponse.json({ success: false, error: "Acción desconocida" }, { status: 400 });
}
