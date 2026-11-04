/**
 * ── E2E del chat (PEER) ── criptografía con WebCrypto, sin dependencias.
 *
 * Modelo:
 *   · Cada DISPOSITIVO tiene un par ECDH P-256. La privada NUNCA sale del
 *     dispositivo (hoy IndexedDB; con el build nativo irá al Keychain).
 *   · Cada conversación tiene una clave simétrica de 32 bytes (AES-GCM).
 *   · Esa clave se "envuelve" para cada dispositivo del destinatario con ECDH
 *     efímero + AES-GCM (sobre = ephPub || iv || ct). El servidor solo guarda
 *     sobres y claves públicas: no puede leer nada.
 *
 * Por qué P-256 y no X25519: P-256 está disponible en todos los WebView
 * actuales (X25519 llegó mucho después a Chrome/WebView).
 *
 * Todo en base64url para viajar por JSON.
 */

const subtle = globalThis.crypto?.subtle;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function isE2ESupported(): boolean {
  return Boolean(subtle);
}

// ── base64url ────────────────────────────────────────────────────────────────
export function toB64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(value: string): Uint8Array {
  const pad = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Identidad del dispositivo ────────────────────────────────────────────────

export interface IdentityKeyPair {
  /** Par para ECDH. La privada no se exporta. */
  privateKey: CryptoKey;
  publicKeyRaw: string; // base64url del punto sin comprimir (65 bytes)
}

/** Genera la identidad del dispositivo (una vez; se guarda en IndexedDB). */
export async function generateIdentity(): Promise<IdentityKeyPair> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = await subtle.exportKey('raw', pair.publicKey);
  return { privateKey: pair.privateKey, publicKeyRaw: toB64url(raw) };
}

export async function importPublicKey(publicKeyRaw: string): Promise<CryptoKey> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  return subtle.importKey(
    'raw',
    fromB64url(publicKeyRaw) as unknown as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

/** Clave AES-GCM derivada del secreto ECDH compartido. */
async function deriveAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const shared = await subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  // HKDF con sal fija de contexto: la clave AES nunca es el secreto ECDH crudo.
  const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('rabbitty-e2e-v1'),
      info: enc.encode('conversation-key-wrap'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Clave de conversación ────────────────────────────────────────────────────

export async function generateConversationKey(): Promise<CryptoKey> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Envuelve la clave de conversación para UN dispositivo.
 * Sobre = ephPub(65) || iv(12) || ct
 */
export async function wrapConversationKey(
  conversationKey: CryptoKey,
  recipientPublicKeyRaw: string,
): Promise<string> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const rawKey = await subtle.exportKey('raw', conversationKey);
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const ephPubRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const recipientPub = await importPublicKey(recipientPublicKeyRaw);
  const aes = await deriveAesKey(eph.privateKey, recipientPub);

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new Uint8Array(rawKey)),
  );

  const out = new Uint8Array(ephPubRaw.length + iv.length + ct.length);
  out.set(ephPubRaw, 0);
  out.set(iv, ephPubRaw.length);
  out.set(ct, ephPubRaw.length + iv.length);
  return toB64url(out);
}

/** Abre el sobre con la privada del dispositivo y devuelve la clave AES. */
export async function unwrapConversationKey(
  wrapped: string,
  myPrivateKey: CryptoKey,
): Promise<CryptoKey> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const bytes = fromB64url(wrapped);
  const ephPubRaw = bytes.slice(0, 65);
  const iv = bytes.slice(65, 77);
  const ct = bytes.slice(77);
  const ephPub = await subtle.importKey(
    'raw',
    ephPubRaw as unknown as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
  const aes = await deriveAesKey(myPrivateKey, ephPub);
  const raw = await subtle.decrypt({ name: 'AES-GCM', iv }, aes, ct as unknown as ArrayBuffer);
  return subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// ── Mensajes ─────────────────────────────────────────────────────────────────

/** Cifra texto → base64url(iv || ciphertext). */
export async function encryptText(conversationKey: CryptoKey, plaintext: string): Promise<string> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, conversationKey, enc.encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toB64url(out);
}

export async function decryptText(conversationKey: CryptoKey, payload: string): Promise<string> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const bytes = fromB64url(payload);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, conversationKey, ct as unknown as ArrayBuffer);
  return dec.decode(plain);
}

/** Cifra un binario (foto/voz) con la clave de la conversación. */
export async function encryptBytes(conversationKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, conversationKey, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out.buffer;
}

export async function decryptBytes(conversationKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  if (!subtle) throw new Error('E2E_UNSUPPORTED');
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  return subtle.decrypt({ name: 'AES-GCM', iv }, conversationKey, ct as unknown as ArrayBuffer);
}
