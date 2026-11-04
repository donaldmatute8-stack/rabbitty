'use client';

/**
 * ── useRealtimeChat ── Fase 3/4 del plan de mensajería.
 *
 * Conecta al transporte realtime SOLO si el backend lo habilita
 * (`/api/realtime/centrifugo` responde enabled:true). Si no, no hace nada y el
 * chat sigue con su intervalo de polling: degradación limpia, sin feature flag
 * extra.
 *
 * Responsabilidades:
 *   · conexión con token de conexión (renovable)
 *   · suscripción al canal `chat:conv_<id>` con token de suscripción
 *   · entrega de mensajes nuevos (el caller dedupe por id)
 *   · typing transient
 *   · heartbeat de presencia (por sesión, no GPS) + presencia del otro
 */

import { useEffect, useRef } from 'react';
import { Centrifuge } from 'centrifuge';
import { PlatformBridge } from '@/lib/platform';

export interface RealtimeChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type?: string;
  metadata?: unknown;
  createdAt?: string;
}

interface Options {
  conversationId: string | null;
  enabled?: boolean;
  onMessage?: (message: RealtimeChatMessage) => void;
  onTyping?: (senderId: string) => void;
  onPeerPresence?: (online: boolean, lastSeenAt: string | null) => void;
}

const HEARTBEAT_MS = 30_000;
const SESSION_KEY = 'rabbitty_chat_session_id';

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = (globalThis.crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

async function fetchTokens(conversationId: string) {
  const headers = await PlatformBridge.getAuthHeaders();
  const res = await fetch('/api/realtime/centrifugo', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  return data as
    | {
        success?: boolean;
        enabled?: boolean;
        wsUrl?: string;
        token?: string;
        channel?: string;
        subscriptionToken?: string;
      }
    | null;
}

export function useRealtimeChat({ conversationId, enabled = true, onMessage, onTyping, onPeerPresence }: Options) {
  // Callbacks en refs: el caller no tiene que memoizarlos y la conexión no se
  // reconecta en cada render (bug clásico de deps con funciones inline).
  const callbacks = useRef({ onMessage, onTyping, onPeerPresence });
  useEffect(() => {
    callbacks.current = { onMessage, onTyping, onPeerPresence };
  }, [onMessage, onTyping, onPeerPresence]);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    let disposed = false;
    let client: Centrifuge | null = null;
    let sub: ReturnType<Centrifuge['newSubscription']> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const sessionId = getSessionId();

    const ping = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/chat/presence', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, sessionId, platform: PlatformBridge.isNative() ? 'native' : 'web' }),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!disposed && data?.success && data.peer) {
          callbacks.current.onPeerPresence?.(
            Boolean(data.peer.online),
            data.peer.lastSeenAt ? String(data.peer.lastSeenAt) : null,
          );
        }
      } catch {
        /* best-effort */
      }
    };

    void (async () => {
      const first = await fetchTokens(conversationId);
      if (disposed) return;
      if (!first?.enabled || !first.token || !first.wsUrl || !first.channel) return; // → polling

      client = new Centrifuge(first.wsUrl, {
        token: first.token,
        // El token dura 10 min; el SDK lo renueva solo al reconectar.
        getToken: async () => {
          const next = await fetchTokens(conversationId);
          if (!next?.token) throw new Error('REALTIME_TOKEN_UNAVAILABLE');
          return next.token;
        },
      });

      sub = client.newSubscription(first.channel!, {
        token: first.subscriptionToken,
        getToken: async () => {
          const next = await fetchTokens(conversationId);
          if (!next?.subscriptionToken) throw new Error('REALTIME_SUB_TOKEN_UNAVAILABLE');
          return next.subscriptionToken;
        },
      });

      sub.on('publication', (ctx) => {
        const data = ctx?.data as Record<string, unknown> | undefined;
        if (!data) return;
        if (data.eventType === 'message.created' && data.messageId) {
          callbacks.current.onMessage?.({
            id: String(data.messageId),
            conversationId: String(data.conversationId ?? conversationId),
            senderId: String(data.senderId ?? ''),
            content: String(data.content ?? ''),
            type: data.type ? String(data.type) : undefined,
            metadata: data.metadata ?? null,
            createdAt: data.createdAt ? String(data.createdAt) : undefined,
          });
        } else if (data.eventType === 'typing' && data.senderId) {
          callbacks.current.onTyping?.(String(data.senderId));
        }
      });

      client.on('connected', () => { void ping(); });
      client.connect();
      sub.subscribe();

      void ping();
      heartbeat = setInterval(() => void ping(), HEARTBEAT_MS);
    })();

    return () => {
      disposed = true;
      if (heartbeat) clearInterval(heartbeat);
      try { sub?.unsubscribe(); } catch { /* noop */ }
      try { client?.disconnect(); } catch { /* noop */ }
      // Cierre limpio de la sesión (si falla, el TTL la apaga sola).
      void (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          await fetch('/api/chat/presence', {
            method: 'DELETE',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
            keepalive: true,
          });
        } catch { /* noop */ }
      })();
    };
  }, [conversationId, enabled]);
}
