'use client';

/**
 * ── Identidad E2E del dispositivo ──
 *
 * El par de claves vive en IndexedDB (clonable, no exportable por JSON). Con el
 * build nativo se moverá al Keychain **sin cambiar el protocolo**: solo cambia
 * dónde se persiste la privada.
 *
 * La clave PÚBLICA se registra en el servidor (user_device_keys) para que el
 * otro lado pueda envolvernos la clave de conversación.
 */

import { generateIdentity, type IdentityKeyPair } from './crypto';
import { PlatformBridge } from '@/lib/platform';

const DB_NAME = 'rabbitty-e2e';
const STORE = 'identity';
const DEVICE_KEY = 'rabbitty_e2e_device_id';

export interface StoredIdentity extends IdentityKeyPair {
  deviceId: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readStored(): Promise<StoredIdentity | null> {
  try {
    const db = await openDb();
    return await new Promise<StoredIdentity | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('me');
      req.onsuccess = () => resolve((req.result as StoredIdentity) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeStored(value: StoredIdentity): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, 'me');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = (globalThis.crypto?.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

let cached: StoredIdentity | null = null;
let inflight: Promise<StoredIdentity | null> | null = null;

/**
 * Devuelve la identidad del dispositivo, creándola la primera vez, y registra
 * la clave pública en el servidor (idempotente).
 */
export async function ensureIdentity(): Promise<StoredIdentity | null> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const deviceId = getDeviceId();
      let stored = await readStored();

      if (!stored || stored.deviceId !== deviceId) {
        const pair = await generateIdentity();
        stored = { ...pair, deviceId };
        await writeStored(stored);
      }

      cached = stored;

      // Registro best-effort: si falla, se reintenta en la próxima apertura.
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        await fetch('/api/chat/e2e/keys', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: stored.deviceId, publicKey: stored.publicKeyRaw }),
        });
      } catch { /* best-effort */ }

      return stored;
    } catch (err) {
      console.warn('[E2E] no se pudo preparar la identidad:', err);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
