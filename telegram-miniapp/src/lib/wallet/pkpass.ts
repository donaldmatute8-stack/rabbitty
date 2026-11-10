/**
 * ── Emisión de pases Apple Wallet ───────────────────────────────────────────
 *
 * Un `.pkpass` es un ZIP con:
 *   pass.json · manifest.json · signature · icon.png (+@2x/@3x) · logo/…
 *
 * `manifest.json` lleva el SHA-1 de cada archivo y `signature` es una firma
 * PKCS#7 *detached* sobre ese manifiesto, usando el certificado Pass Type ID,
 * su llave y el certificado intermedio WWDR de Apple.
 *
 * Sin esos tres insumos Wallet rechaza el pase, así que si faltan devolvemos null
 * y la ruta responde 501 en vez de entregar un archivo roto.
 */

import forge from "node-forge";
import JSZip from "jszip";
import { ICON_PNG, ICON2X_PNG, ICON3X_PNG } from "./assets";

export interface WalletCredentials {
  passTypeIdentifier: string;
  teamIdentifier: string;
  certPem: string;
  keyPem: string;
  wwdrPem: string;
}

export interface WalletPassInput {
  serialNumber: string;
  description: string;
  organizationName: string;
  planName: string;
  businessName: string;
  memberName?: string | null;
  memberSince?: string | null;
  status?: string;
  accentColor?: string | null;
  memberIdShort?: string | null;
}

/** Las PEM en variables de entorno suelen venir con "\n" literales. */
function normalizePem(value: string | undefined): string {
  if (!value) return "";
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export function getWalletCredentials(env: NodeJS.ProcessEnv = process.env): WalletCredentials | null {
  const passTypeIdentifier = env.APPLE_WALLET_PASS_TYPE_ID?.trim();
  const teamIdentifier = env.APPLE_WALLET_TEAM_ID?.trim();
  const certPem = normalizePem(env.APPLE_WALLET_CERT_PEM);
  const keyPem = normalizePem(env.APPLE_WALLET_KEY_PEM);
  const wwdrPem = normalizePem(env.APPLE_WALLET_WWDR_PEM);

  if (!passTypeIdentifier || !teamIdentifier || !certPem || !keyPem || !wwdrPem) return null;
  if (!certPem.includes("BEGIN CERTIFICATE") || !keyPem.includes("BEGIN") || !wwdrPem.includes("BEGIN CERTIFICATE")) {
    return null;
  }
  return { passTypeIdentifier, teamIdentifier, certPem, keyPem, wwdrPem };
}

/** `#E91E63` → `rgb(233,30,99)`. Si no es hex, cae al rosa de Rabbitty. */
function toRgb(hex?: string | null): string {
  const raw = (hex || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return "rgb(233,30,99)";
  const n = parseInt(raw, 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

export function buildPassJson(input: WalletPassInput, creds: WalletCredentials) {
  const since = input.memberSince
    ? new Date(input.memberSince).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return {
    formatVersion: 1,
    passTypeIdentifier: creds.passTypeIdentifier,
    serialNumber: input.serialNumber,
    teamIdentifier: creds.teamIdentifier,
    organizationName: input.organizationName,
    description: input.description,
    logoText: "Rabbitty",
    backgroundColor: "rgb(12,8,16)",
    foregroundColor: "rgb(255,255,255)",
    labelColor: toRgb(input.accentColor),
    sharingProhibited: false,
    suppressStripShine: true,
    storeCard: {
      primaryFields: [
        { key: "plan", label: "MEMBRESÍA", value: input.planName },
      ],
      secondaryFields: [
        { key: "business", label: "NEGOCIO", value: input.businessName },
        ...(since ? [{ key: "since", label: "MIEMBRO DESDE", value: since }] : []),
      ],
      auxiliaryFields: [
        { key: "status", label: "ESTADO", value: input.status || "Activa" },
        ...(input.memberName ? [{ key: "member", label: "MIEMBRO", value: input.memberName }] : []),
      ],
      backFields: [
        {
          key: "howto",
          label: "CÓMO USARLA",
          value:
            "Abre Rabbitty → Mis Membresías y muestra el código QR en caja. El código cambia cada 30 segundos por seguridad, por eso no vive dentro de este pase.",
        },
        {
          key: "terms",
          label: "CONDICIONES",
          value:
            "Membresía personal e intransferible. Los beneficios se canjean en el negocio emisor y están sujetos a disponibilidad.",
        },
        ...(input.memberIdShort
          ? [{ key: "id", label: "ID DE MIEMBRO", value: input.memberIdShort }]
          : []),
        {
          // Universal link: iOS lo abre en Rabbitty si la app está instalada
          // (ver /memberships* en apple-app-site-association).
          key: "open",
          label: "ABRIR EN LA APP",
          value: `https://app.rabbitty.me/memberships?pass=${encodeURIComponent(input.serialNumber)}`,
        },
        { key: "help", label: "SOPORTE", value: "https://app.rabbitty.me/support" },
      ],
    },
  };
}

function sha1Hex(bytes: Buffer): string {
  const hash = forge.md.sha1.create();
  hash.update(bytes.toString("binary"));
  return hash.digest().toHex();
}

/**
 * Firma PKCS#7 detached del manifiesto. SHA-1 es lo que usa `signpass` de Apple;
 * Wallet lo sigue aceptando y evita sorpresas entre versiones de iOS.
 */
export function signManifest(manifestJson: string, creds: WalletCredentials): Buffer {
  const cert = forge.pki.certificateFromPem(creds.certPem);
  const key = forge.pki.privateKeyFromPem(creds.keyPem);
  const wwdr = forge.pki.certificateFromPem(creds.wwdrPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestJson, "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });

  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

export async function buildPkpass(input: WalletPassInput, creds: WalletCredentials): Promise<Buffer> {
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(buildPassJson(input, creds)), "utf8"),
    "icon.png": Buffer.from(ICON_PNG, "base64"),
    "icon@2x.png": Buffer.from(ICON2X_PNG, "base64"),
    "icon@3x.png": Buffer.from(ICON3X_PNG, "base64"),
    "logo.png": Buffer.from(ICON_PNG, "base64"),
    "logo@2x.png": Buffer.from(ICON2X_PNG, "base64"),
  };

  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1Hex(bytes);
  const manifestJson = JSON.stringify(manifest);
  const signature = signManifest(manifestJson, creds);

  const zip = new JSZip();
  for (const [name, bytes] of Object.entries(files)) {
    zip.file(name, bytes, { compression: "STORE" });
  }
  zip.file("manifest.json", manifestJson, { compression: "STORE" });
  zip.file("signature", signature, { compression: "STORE", binary: true });

  return zip.generateAsync({ type: "nodebuffer", compression: "STORE", platform: "UNIX" });
}
