'use client';

/**
 * ── Clave de conversación E2E ──
 *
 * Primera vez: se genera un AES-GCM 256 y se "envuelve" para CADA dispositivo
 * de los participantes (sobres). El servidor solo guarda los sobres.
 *
 * Si el otro lado todavía no tiene claves registradas (nunca abrió la app con
 * esta versión), NO se cifra: se devuelve null y el chat sigue en claro. Es
 * preferible a mandar un mensaje que el destinatario no pueda abrir.
 */

import { generateConversationKey, unwrapConversationKey, wrapConversationKey } from './crypto';
import type { StoredIdentity } from './identity';
import { PlatformBridge } from '@/lib/platform';

const cacheMap = new Map<string, ConversationKeys>();

export interface ConversationKeys {
  /** Todas las versiones disponibles en este dispositivo. */
  keys: Map<number, CryptoKey>;
  /** Versión vigente (la que se usa para ENVIAR). */
  currentVersion: number;
}

export async function ensureConversationKey(
  conversationId: string,
  me: StoredIdentity,
  myUserId: string,
  peerUserIds: string[],
  keyVersion = 1,
): Promise<ConversationKeys | null> {
  // Caché por conversación: guarda el mapa de versiones (no una sola llave).
  const cached = cacheMap.get(conversationId);
  if (cached && cached.currentVersion === keyVersion && cached.keys.has(keyVersion)) return cached;

  try {
    const headers = await PlatformBridge.getAuthHeaders();

    // 1) Abrir TODAS mis versiones (el historial se lee con la suya).
    const mine = await fetch(
      `/api/chat/e2e/conversation-keys?conversationId=${encodeURIComponent(conversationId)}&deviceId=${encodeURIComponent(me.deviceId)}`,
      { headers, cache: 'no-store' },
    )
      .then((r) => r.json())
      .catch(() => null);

    const keys = new Map<number, CryptoKey>();
    const sealed: Array<{ keyVersion: number; wrappedKey: string }> = Array.isArray(mine?.keys) ? mine.keys : [];
    for (const s of sealed) {
      try {
        keys.set(Number(s.keyVersion) || 1, await unwrapConversationKey(String(s.wrappedKey), me.privateKey));
      } catch { /* versión ilegible: se ignora */ }
    }

    if (keys.has(keyVersion)) {
      const result = { keys, currentVersion: keyVersion };
      cacheMap.set(conversationId, result);
      return result;
    }

    // 2) Claves públicas de los demás dispositivos
    const ids = Array.from(new Set([myUserId, ...peerUserIds].filter(Boolean)));
    const peers = await fetch(`/api/chat/e2e/keys?userIds=${encodeURIComponent(ids.join(','))}`, {
      headers,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .catch(() => null);

    const devices: Array<{ userId: string; deviceId: string; publicKey: string }> = Array.isArray(peers?.keys)
      ? peers.keys
      : [];
    const peerDevices = devices.filter((d) => d.userId !== myUserId);
    // Sin dispositivos del otro lado no hay a quién envolverle la clave.
    if (peerDevices.length === 0) return null;

    // 3) Crear y repartir
    const key = await generateConversationKey();
    const entries: Array<{ recipientUserId: string; recipientDeviceId: string; wrappedKey: string }> = [];

    for (const d of peerDevices) {
      entries.push({
        recipientUserId: d.userId,
        recipientDeviceId: d.deviceId,
        wrappedKey: await wrapConversationKey(key, d.publicKey),
      });
    }
    // Mi propio sobre (para mis otros dispositivos, si los tengo).
    entries.push({
      recipientUserId: myUserId,
      recipientDeviceId: me.deviceId,
      wrappedKey: await wrapConversationKey(key, me.publicKeyRaw),
    });

    await fetch('/api/chat/e2e/conversation-keys', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, entries, keyVersion }),
    });

    keys.set(keyVersion, key);
    const result = { keys, currentVersion: keyVersion };
    cacheMap.set(conversationId, result);
    return result;
  } catch (err) {
    console.warn('[E2E] no se pudo preparar la clave de conversación:', err);
    return null;
  }
}

export function forgetConversationKey(conversationId: string): void {
  cacheMap.delete(conversationId);
}
