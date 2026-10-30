import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings, users } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import {
  isGodAdminIdentity,
  verifyGod2faCookieValue,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
  createWebauthnChallenge,
  popWebauthnChallenge,
  b64urlDecode,
  b64urlEncode,
  type StoredPasskey,
} from "@rabbitty/api/services/god2fa";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

export const runtime = "nodejs";

const PASSKEYS_KEY = "god_admin_passkeys";

function readGod2faCookie(req: NextRequest): string | undefined {
  return req.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(`${GOD_2FA_COOKIE}=`))?.slice(GOD_2FA_COOKIE.length + 1);
}

function rpIdFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "admin.rabbitty.me";
  return host.split(":")[0];
}

async function loadPasskeys(): Promise<StoredPasskey[]> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, PASSKEYS_KEY)).limit(1);
  if (!row?.value) return [];
  try { return JSON.parse(row.value) as StoredPasskey[]; } catch { return []; }
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

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";
  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }); }

  const action = String(body.action || "");
  const rpId = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "admin.rabbitty.me").split(":")[0];
  const origin = `https://${rpId}`;

  // ── REGISTER OPTIONS (requiere 2FA verificado) ──
  if (action === "register_options") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) return NextResponse.json({ success: false, error: "Verifica tu 2FA primero" }, { status: 401 });
    const challenge = createWebauthnChallenge(`reg:${email}`);
    const userId = b64urlEncode(crypto.createHash("sha256").update(email).digest());
    return NextResponse.json({
      success: true,
      challenge,
      rp: { id: rpId, name: "Rabbitty God Admin" },
      user: { id: b64urlEncode(Buffer.from(email)), name: email, displayName: "God Admin" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
    });
  }

  // ── REGISTER VERIFY ──
  if (action === "register_verify") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) return NextResponse.json({ success: false, error: "Sesión 2FA expirada" }, { status: 401 });
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.create") throw new Error("Tipo inválido");
      if (!popWebauthnChallenge(`reg:${email}`, clientData.challenge)) throw new Error("Challenge inválido");
      if (!clientData.origin.endsWith(rpId)) throw new Error("Origen no permitido");

      const attestationObject = b64urlDecode(String(body.attestationObject));
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyRegistrationResponse({
        response: {
          id: String(body.credentialId),
          rawId: String(body.credentialId),
          response: {
            clientDataJSON: b64urlEncode(clientDataJSON),
            attestationObject: b64urlEncode(attestationObject),
          },
          type: "public-key",
          clientExtensionResults: {},
        },
        expectedChallenge: clientData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
      });

      if (!verification.verified || !verification.registrationInfo?.credential) throw new Error("Verificación fallida");
      const { credential } = verification.registrationInfo;

      const jwk = {
        kty: "EC",
        crv: "P-256",
        x: Buffer.from(credential.publicKey).toString("base64url").slice(0, 43),
        y: Buffer.from(credential.publicKey).toString("base64url").slice(43, 86),
      };

      const passkeys = await loadPasskeys();
      const credIdB64 = String(body.credentialId);
      if (passkeys.some(p => p.credId === credIdB64)) throw new Error("Passkey ya registrada");
      passkeys.push({
        credId: credIdB64,
        publicKeyJwk: jwk,
        signCount: 0,
        label: String(body.label || `Passkey ${passkeys.length + 1}`),
        createdAt: new Date().toISOString(),
      });
      await savePasskeys(passkeys);
      return NextResponse.json({ success: true, total: passkeys.length });
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Registro fallido" }, { status: 400 });
    }
  }

  // ── UNLOCK (Face ID sin teclear el TOTP) ──
  if (action === "unlock_options") {
    const passkeys = await loadPasskeys();
    if (passkeys.length === 0) return NextResponse.json({ success: false, error: "Sin passkeys registradas" }, { status: 404 });
    const challenge = createWebauthnChallenge(`unlock:${email}`);
    const toB64url = (b64s: string) => b64s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return NextResponse.json({ success: true, challenge, allowCredentialIds: passkeys.map(p => toB64url(p.credId)) });
  }

  if (action === "unlock_verify") {
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.get") throw new Error("Tipo inválido");
      if (!popWebauthnChallenge(`unlock:${email}`, clientData.challenge)) throw new Error("Challenge inválido");
      if (!clientData.origin.endsWith(rpId)) throw new Error("Origen no permitido");

      const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
      const passkeys = await loadPasskeys();
      const rawCredId = String(body.credentialId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const toStdB64 = (u: string) => { const std = u.replace(/-/g, '+').replace(/_/g, '/'); return std + '='.repeat((4 - (std.length % 4)) % 4); };
      const presentedCredId = toStdB64(rawCredId);
      const match = passkeys.find(p => toStdB64(p.credId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) === presentedCredId);
      if (!match) throw new Error("Passkey no registrada");

      const authDataBuf = b64urlDecode(String(body.authenticatorData));
      const signature = b64urlDecode(String(body.signature));

      // Reconstruir la publicKey desde el JWK almacenado
      const jwk = match.publicKeyJwk;
      const { createPublicKey } = await import("crypto");
      const keyObj = createPublicKey({ key: jwk as any, format: "jwk" });
      const spkiDer = keyObj.export({ type: "spki", format: "der" });
      const coseKey = {
        1: 2, 3: -7,
        "-1": Buffer.from([1]), // P-256
        "-2": Buffer.from(jwk.x, "base64url"),
        "-3": Buffer.from(jwk.y, "base64url"),
      };
      const coseBuf = encodeCoseKey(coseKey);

      const verification = await verifyAuthenticationResponse({
        response: {
          id: presentedCredId,
          rawId: presentedCredId,
          response: {
            authenticatorData: b64urlEncode(authDataBuf),
            clientDataJSON: b64urlEncode(clientDataJSON),
            signature: b64urlEncode(signature),
          },
          type: "public-key",
          clientExtensionResults: {},
        },
        expectedChallenge: clientData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: new TextEncoder().encode(presentedCredId),
          publicKey: coseBuf,
          counter: match.signCount,
        } as any,
        requireUserVerification: true,
      });

      if (!verification.verified) throw new Error("Verificación fallida");

      match.signCount = verification.authenticationInfo.newCounter;
      await savePasskeys(passkeys);

      const res = NextResponse.json({ success: true });
      res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60, path: "/",
      });
      return res;
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Verificación fallida" }, { status: 401 });
    }
  }

  // ── LIST / DELETE ──
  if (action === "list") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    const passkeys = await loadPasskeys();
    return NextResponse.json({ success: true, passkeys: passkeys.map(p => ({ credId: p.credId, label: p.label, createdAt: p.createdAt })) });
  }

  if (action === "delete") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    const passkeys = await loadPasskeys();
    const next = passkeys.filter(p => p.credId !== String(body.credId));
    await savePasskeys(next);
    return NextResponse.json({ success: true, total: next.length });
  }

  return NextResponse.json({ success: false, error: "Acción desconocida" }, { status: 400 });
}

// ── CBOR encoder para COSE key (solo lo necesario para reconstruir la key) ──
function encodeCoseKey(cose: Record<number | string, unknown>): Buffer {
  const entries: Array<[number, unknown]> = [];
  for (const [k, v] of Object.entries(cose)) {
    entries.push([parseInt(k), v]);
  }
  entries.sort((a, b) => a[0] - b[0]);
  const parts: Buffer[] = [];
  // map header: 5 elementos → 0xA5
  parts.push(Buffer.from([0xA5]));
  for (const [key, value] of entries) {
    // key (int)
    if (key >= 0) {
      parts.push(Buffer.from([key <= 23 ? key : 0x18, ...(key > 23 ? [key] : [])]));
    } else {
      const abs = -1 - key;
      parts.push(Buffer.from(abs <= 23 ? [0x20 + abs] : [0x38, abs]));
    }
    // value (bytes)
    if (Buffer.isBuffer(value)) {
      if (value.length <= 23) parts.push(Buffer.from([0x40 + value.length]));
      else if (value.length <= 255) parts.push(Buffer.from([0x58, value.length]));
      else parts.push(Buffer.from([0x59, value.length >> 8, value.length & 0xFF]));
      parts.push(value);
    } else if (typeof value === "number") {
      if (value >= 0) parts.push(Buffer.from([value <= 23 ? value : 0x18, ...(value > 23 ? [value] : [])]));
      else {
        const abs = -1 - value;
        parts.push(Buffer.from(abs <= 23 ? [0x20 + abs] : [0x38, abs]));
      }
    }
  }
  return Buffer.concat(parts);
}