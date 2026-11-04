#!/usr/bin/env node
/**
 * ── PoC Centrifugo (Fase 2 del plan de mensajería) ──
 *
 * Valida CONTRA EL SERVIDOR REAL los puntos de seguridad y rendimiento que el
 * plan exige para dar GO a la Fase 3. No toca el chat real: usa `chat:demo`.
 *
 * Uso (con el contenedor arriba: docker compose -f docker-compose.centrifugo.yml up -d):
 *   node scripts/centrifugo-poc.mjs
 *
 * Requiere el SDK: `pnpm add -D centrifuge` (o `npm i centrifuge` en este dir).
 *
 * Qué comprueba:
 *   1. Conexión SIN token → rechazada.
 *   2. Conexión con token firmado → aceptada.
 *   3. Subscribe SIN token de suscripción → rechazado (canal privado).
 *   4. Subscribe con token de suscripción → aceptado.
 *   5. Publish desde el cliente → rechazado (el cliente no puede escribir).
 *   6. Latencia publish(HTTP API) → recibir: p50 / p95 (criterio: p95 < 300 ms).
 *   7. Reconexión con recovery: sin pérdida de eventos publicados mientras estaba caído.
 *
 * Salida: un JSON resumen + exit code 1 si algún criterio falla.
 */

import crypto from 'node:crypto';
import { Centrifuge } from 'centrifuge';

const WS_URL = process.env.CENTRIFUGO_WS_URL || 'ws://localhost:8000/connection/websocket';
const API_URL = process.env.CENTRIFUGO_API_URL || 'http://localhost:8000/api';
const API_KEY = process.env.CENTRIFUGO_API_KEY || 'dev-api-key-centrifugo-poc';
const TOKEN_SECRET = process.env.CENTRIFUGO_TOKEN_SECRET || 'dev-token-secret-centrifugo-poc';
const CHANNEL = 'chat:demo';

const b64url = (value) => Buffer.from(value).toString('base64url');

/** Firma HS256 (lo mismo que hará el backend en src/lib/realtime/centrifugo.ts). */
function signJwt(claims, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

const now = () => Math.floor(Date.now() / 1000);
const connectionToken = (sub) => signJwt({ sub, exp: now() + 300 }, TOKEN_SECRET);
const subscriptionToken = (sub, channel) => signJwt({ sub, channel, exp: now() + 300 }, TOKEN_SECRET);

async function apiPublish(channel, data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ method: 'publish', params: { channel, data } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) throw new Error(`publish falló: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function waitEvent(emitter, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
    emitter.once(event, (ctx) => {
      clearTimeout(timer);
      resolve(ctx);
    });
  });
}

const results = {};

async function testNoTokenRejected() {
  // Verificado contra v6.10.2: sin token, el server responde disconnected 3501
  // ("bad request"); nunca llega a "connected".
  const client = new Centrifuge(WS_URL, {});
  const state = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ state: client.state, code: null }), 3000);
    client.on('disconnected', (ctx) => {
      clearTimeout(timer);
      resolve({ state: 'disconnected', code: ctx?.code ?? null });
    });
    client.on('connected', () => {
      clearTimeout(timer);
      resolve({ state: 'connected', code: null });
    });
    client.connect();
  });
  client.disconnect();
  await wait(200);
  const ok = state.state !== 'connected';
  results['1_sin_token_rechazado'] = { ok, detalle: state };
  return ok;
}

async function testWithTokenAndSubscribe(userId) {
  const client = new Centrifuge(WS_URL, { token: connectionToken(userId) });
  const connected = waitEvent(client, 'connected');
  client.connect();
  await connected;

  const sub = client.newSubscription(CHANNEL);
  let everSubscribed = false;
  sub.on('subscribed', () => { everSubscribed = true; });
  sub.subscribe();
  await wait(2000);
  const sinTokenState = sub.state;
  results['2_conexion_con_token'] = { ok: client.state === 'connected', sub: userId };
  results['3_subscribe_sin_token_rechazado'] = {
    ok: !everSubscribed && sinTokenState !== 'subscribed',
    detalle: { estado: sinTokenState, llegoASuscribirse: everSubscribed },
  };

  try { sub.unsubscribe(); } catch { /* ya estaba fuera */ }
  await wait(400);
  // centrifuge-js no permite dos subscriptions del mismo canal en un cliente:
  // hay que quitarla explícitamente antes de crear la que sí lleva token.
  try { client.removeSubscription(sub); } catch { /* noop */ }

  const sub2 = client.newSubscription(CHANNEL, { token: subscriptionToken(userId, CHANNEL) });
  const subscribed = waitEvent(sub2, 'subscribed');
  sub2.subscribe();
  await subscribed;
  results['4_subscribe_con_token'] = { ok: true };

  return { client, sub: sub2 };
}

async function testClientPublishRejected(sub) {
  let detalle = 'publicado';
  try {
    await sub.publish({ intento: 'no permitido' });
  } catch (err) {
    detalle = err?.code ? `rechazado(${err.code})` : `rechazado(${String(err?.message || err).slice(0, 60)})`;
  }
  const ok = detalle !== 'publicado';
  results['5_publish_cliente_rechazado'] = { ok, detalle };
  return ok;
}

async function testLatency(sub) {
  const samples = [];
  let pending = 0;
  const onPub = (ctx) => {
    const sentAt = Number(ctx?.data?.sentAt || 0);
    if (sentAt) samples.push(Date.now() - sentAt);
  };
  sub.on('publication', onPub);

  const total = 100;
  for (let i = 0; i < total; i++) {
    pending += 1;
    await apiPublish(CHANNEL, { sentAt: Date.now(), i });
    await wait(10);
  }
  // esperar a que lleguen las últimas
  for (let i = 0; i < 40 && samples.length < total; i++) await wait(25);
  sub.off?.('publication', onPub) ?? sub.removeListener?.('publication', onPub);

  samples.sort((a, b) => a - b);
  const pct = (p) => samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))] ?? null;
  const out = {
    enviados: pending,
    recibidos: samples.length,
    p50: pct(50),
    p95: pct(95),
    max: samples[samples.length - 1] ?? null,
  };
  out.ok = samples.length >= total * 0.95 && (pct(95) ?? Infinity) < 300;
  results['6_latencia'] = out;
  return out.ok;
}

async function testRecovery(client, sub) {
  const received = [];
  const onPub = (ctx) => received.push(ctx?.data?.marca ?? null);
  sub.on('publication', onPub);

  client.disconnect();
  await wait(400);
  const offline = ['A', 'B', 'C'];
  for (const marca of offline) await apiPublish(CHANNEL, { marca, sentAt: Date.now() });

  const reconnected = waitEvent(client, 'connected', 8000);
  client.connect();
  await reconnected;
  await wait(1200);

  sub.off?.('publication', onPub) ?? sub.removeListener?.('publication', onPub);

  const recuperados = offline.filter((m) => received.includes(m));
  results['7_recovery_sin_perdida'] = {
    ok: recuperados.length === offline.length,
    publicados_offline: offline,
    recuperados,
  };
  return results['7_recovery_sin_perdida'].ok;
}

(async () => {
  try {
    console.log(`PoC Centrifugo → ${WS_URL} (canal ${CHANNEL})\n`);

    await testNoTokenRejected();

    const { client, sub } = await testWithTokenAndSubscribe('user_poc_1');
    await testClientPublishRejected(sub);
    await testLatency(sub);
    await testRecovery(client, sub);
    client.disconnect();
  } catch (err) {
    console.error('PoC abortada:', err?.message || err);
    results.fatal = String(err?.message || err);
  }

  const checks = Object.entries(results).filter(([k]) => /^\d_/.test(k));
  const failed = checks.filter(([, v]) => !v.ok);

  console.log(JSON.stringify(results, null, 2));
  console.log(
    `\n${failed.length === 0 ? '✅ GO' : '❌ NO-GO'} — ${checks.length - failed.length}/${checks.length} criterios`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
})();
