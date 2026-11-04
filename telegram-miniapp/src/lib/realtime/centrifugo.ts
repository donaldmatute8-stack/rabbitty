/**
 * ── Centrifugo: emisión de tokens (server-only) ──
 *
 * Centrifugo NO es dueño del chat: es el mensajero. Postgres sigue siendo la
 * única verdad. Este módulo solo firma los JWT que el cliente presenta para
 * (a) conectarse y (b) suscribirse a un canal concreto.
 *
 * Modelo de seguridad verificado contra Centrifugo v6.10.2 (Fase 2 del plan):
 *   · Sin token de conexión              → disconnected 3501.
 *   · Sin token de suscripción al canal  → nunca llega a "subscribed".
 *   · Publish desde el cliente           → rechazado (código 103).
 *
 * Claims firmados (HS256):
 *   conexión:     { sub: <userId>, exp }
 *   suscripción:  { sub: <userId>, channel: <canal>, exp }
 *
 * El `sub` es SIEMPRE el userId de Rabbitty y el servidor de chat publica con
 * su API key: el cliente jamás puede escribir en un canal.
 */

import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 10 * 60; // corto: el cliente pide otro al reconectar

export interface RealtimeConfig {
  wsUrl: string;
  enabled: boolean;
}

function secret(): string | null {
  const value = process.env.CENTRIFUGO_TOKEN_SECRET;
  return value && value.trim().length >= 16 ? value.trim() : null;
}

/** ¿Está configurado el transporte realtime? (si no, todo cae a polling). */
export function isRealtimeConfigured(): boolean {
  return Boolean(secret()) && Boolean(process.env.NEXT_PUBLIC_CENTRIFUGO_URL);
}

export function getRealtimeConfig(): RealtimeConfig {
  return {
    wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_URL || '',
    enabled: isRealtimeConfigured(),
  };
}

const b64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

function signHs256(claims: Record<string, unknown>): string | null {
  const key = secret();
  if (!key) return null;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', key).update(data).digest('base64url');
  return `${data}.${signature}`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Token de CONEXIÓN: identifica al usuario frente a Centrifugo. */
export function createConnectionToken(userId: string): string | null {
  if (!userId) return null;
  return signHs256({ sub: userId, exp: nowSeconds() + TOKEN_TTL_SECONDS });
}

/**
 * Token de SUSCRIPCIÓN: autoriza UN canal concreto para ese usuario.
 * El servidor decide si el usuario pertenece a la conversación ANTES de
 * firmarlo (ver /api/realtime/centrifugo). Sin este token, el canal es
 * inaccesible aunque la conexión sea válida.
 */
export function createSubscriptionToken(userId: string, channel: string): string | null {
  if (!userId || !channel) return null;
  return signHs256({
    sub: userId,
    channel,
    exp: nowSeconds() + TOKEN_TTL_SECONDS,
  });
}

/** Canal de una conversación (único formato permitido en Fase 3). */
export function conversationChannel(conversationId: string): string {
  return `chat:conv_${conversationId}`;
}

/**
 * Canal de demo de la PoC (Fase 2). Solo se permite si REALTIME_POC_ENABLED=1,
 * para que nunca haya un canal abierto en producción por accidente.
 */
export function isPocChannelAllowed(channel: string): boolean {
  if (process.env.REALTIME_POC_ENABLED !== '1') return false;
  return channel === 'chat:demo' || channel.startsWith('chat:poc_');
}
