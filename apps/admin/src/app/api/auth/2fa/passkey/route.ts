import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import {
  isGodAdminIdentity,
  cborDecodeFull,
  verifyGod2faCookieValue,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
  createWebauthnChallenge,
  popWebauthnChallenge,
  parseAuthData,
  coseKeyToJwk,
  verifyPasskeySignature,
  expectedRpIdHash,
  b64urlDecode,
  b64urlEncode,
  type StoredPasskey,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

const PASSKEYS_KEY = "god_admin_passkeys";

function readGod2faCookie(req: NextRequest): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("god2fa="))
    ?.slice(7);
}

async function loadPasskeys(): Promise<StoredPasskey[]> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, PASSKEYS_KEY)).limit(1);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as StoredPasskey[]) : [];
  } catch {
    return [];
  }
}

async function savePasskeys(list: StoredPasskey[]): Promise<void> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, PASSKEYS_KEY)).limit(1);
  if (row) {
    await db.update(systemSettings).set({ value: JSON.stringify(list), updatedAt: new Date() }).where(eq(systemSettings.key, PASSKEYS_KEY));
  } else {
    await db.insert(systemSettings).values({ key: PASSKEYS_KEY, value: JSON.stringify(list) });
  }
}

function rpIdFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "admin.rabbitty.me";
  return host.split(":")[0];
}

function bufferToB64(buf: ArrayBuffer): string {
  return b64urlEncode(Buffer.from(new Uint8Array(buf)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";
  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }
  const action = String(body.action || "");
  const rpId = rpIdFrom(req);

  // ── Registrar nueva passkey: requiere 2FA TOTP ya verificado en esta sesión ──
  if (action === "register_options") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA antes de registrar una passkey" }, { status: 401 });
    }
    const challenge = createWebauthnChallenge(`reg:${email}`);
    return NextResponse.json({
      success: true,
      challenge,
      rp: { id: rpId, name: "Rabbitty God Admin" },
      user: {
        id: b64urlEncode(crypto.createHash("sha256").update(email).digest()),
        name: email,
        displayName: "God Admin",
      },
    });
  }

  if (action === "register_verify") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Sesión 2FA expirada" }, { status: 401 });
    }
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.create") throw new Error("Tipo de ceremony inválido");
      if (!popWebauthnChallenge(`reg:${email}`, clientData.challenge)) throw new Error("Challenge inválido o expirado");
      const origin = `https://${rpId}`;
      if (!clientData.origin.endsWith(rpId)) throw new Error(`Origen no permitido: ${clientData.origin}`);

      const attestationObject = b64urlDecode(String(body.attestationObject));
      const decoded = cborDecodeFull(attestationObject) as Record<string, unknown>;
      const authDataBuf = Buffer.from(
        decoded.authData instanceof ArrayBuffer
          ? new Uint8Array(decoded.authData)
          : (decoded.authData as Uint8Array)
      );
      const parsed = parseAuthData(authDataBuf);
      if (!parsed.credId || !parsed.coseKey) throw new Error("authData sin credencial");
      const jwk = coseKeyToJwk(parsed.coseKey);
      if (!jwk) throw new Error("Algoritmo no soportado (solo ES256/P-256)");

      const passkeys = await loadPasskeys();
      const credIdB64 = b64urlEncode(parsed.credId);
      if (passkeys.some((p) => p.credId === credIdB64)) throw new Error("Passkey ya registrada");
      passkeys.push({
        credId: credIdB64,
        publicKeyJwk: jwk,
        signCount: parsed.signCount,
        label: String(body.label || `Passkey ${passkeys.length + 1}`),
        createdAt: new Date().toISOString(),
      });
      await savePasskeys(passkeys);
      return NextResponse.json({ success: true, total: passkeys.length });
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Registro fallido" }, { status: 400 });
    }
  }

  // ── Unlock biométrico: reemplaza el TOTP en dispositivos de confianza ──
  if (action === "unlock_options") {
    const passkeys = await loadPasskeys();
    if (passkeys.length === 0) {
      return NextResponse.json({ success: false, error: "Sin passkeys registradas. Entra con TOTP y registra una en Configuración." }, { status: 404 });
    }
    const challenge = createWebauthnChallenge(`unlock:${email}`);
    return NextResponse.json({
      success: true,
      challenge,
      allowCredentialIds: passkeys.map((p) => p.credId),
    });
  }

  if (action === "unlock_verify") {
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.get") throw new Error("Tipo de ceremony inválido");
      if (!popWebauthnChallenge(`unlock:${email}`, clientData.challenge)) throw new Error("Challenge inválido o expirado");
      if (!clientData.origin.endsWith(rpId)) throw new Error("Origen no permitido");

      const authDataBuf = b64urlDecode(String(body.authenticatorData));
      const signature = b64urlDecode(String(body.signature));
      const presentedCredId = b64urlDecode(String(body.credentialId));

      const passkeys = await loadPasskeys();
      const match = passkeys.find((p) => p.credId === b64urlEncode(presentedCredId));
      if (!match) throw new Error("Passkey no registrada en este servidor");

      const parsed = parseAuthData(authDataBuf);
      if (!parsed.flags || !(parsed.flags & 0x01)) throw new Error("User presence no verificada");
      if (!(parsed.flags & 0x04)) throw new Error("User verification (biometría) requerida");
      if (Buffer.compare(parsed.rpIdHash, expectedRpIdHash(rpId)) !== 0) throw new Error("rpIdHash no coincide");
      if (parsed.signCount < match.signCount && match.signCount > 0) throw new Error("Contador de firma sospechoso (posible clon)");

      const ok = verifyPasskeySignature(match.publicKeyJwk, authDataBuf, clientDataJSON, signature);
      if (!ok) throw new Error("Firma inválida");

      // Actualizar signCount
      match.signCount = parsed.signCount;
      await savePasskeys(passkeys);

      const res = NextResponse.json({ success: true });
      res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60,
        path: "/",
      });
      return res;
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Verificación fallida" }, { status: 401 });
    }
  }

  // ── Listar / eliminar passkeys (requiere 2FA verificado) ──
  if (action === "list") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    }
    const passkeys = await loadPasskeys();
    return NextResponse.json({
      success: true,
      passkeys: passkeys.map((p) => ({ credId: p.credId, label: p.label, createdAt: p.createdAt })),
    });
  }

  if (action === "delete") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    }
    const passkeys = await loadPasskeys();
    const next = passkeys.filter((p) => p.credId !== String(body.credId));
    await savePasskeys(next);
    return NextResponse.json({ success: true, total: next.length });
  }

  return NextResponse.json({ success: false, error: "Acción desconocida" }, { status: 400 });
}
