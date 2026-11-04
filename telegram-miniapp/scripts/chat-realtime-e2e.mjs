#!/usr/bin/env node
/**
 * ── E2E del canal de chat (Fase 3/4) ──
 *
 * Verifica el CONTRATO DE RED entre el worker (server) y el cliente:
 *   · canal `chat:conv_<id>` con token de suscripción
 *   · publish tipo `message.created` → el cliente recibe messageId/content/type
 *   · publish tipo `typing` → el cliente lo reconoce como typing
 *   · un tercero NO puede suscribirse a ese canal (sin token válido para él)
 *   · el cliente no puede publicar
 *
 * Uso (Centrifugo local arriba):
 *   node scripts/chat-realtime-e2e.mjs
 */

import crypto from 'node:crypto';
import { Centrifuge } from 'centrifuge';

const WS_URL = process.env.CENTRIFUGO_WS_URL || 'ws://localhost:8000/connection/websocket';
const API_URL = process.env.CENTRIFUGO_API_URL || 'http://localhost:8000/api';
const API_KEY = process.env.CENTRIFUGO_API_KEY || 'dev-api-key-centrifugo-poc';
const SECRET = process.env.CENTRIFUGO_TOKEN_SECRET || 'dev-token-secret-centrifugo-poc';

const CONV = 'e2e_conv';
const CHANNEL = `chat:conv_${CONV}`;

const b64url = (v) => Buffer.from(v).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const sign = (claims) => {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(claims));
  const d = `${h}.${p}`;
  return `${d}.${crypto.createHmac('sha256', SECRET).update(d).digest('base64url')}`;
};
const connToken = (sub) => sign({ sub, exp: now() + 300 });
const subToken = (sub, ch) => sign({ sub, channel: ch, exp: now() + 300 });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function publish(data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ method: 'publish', params: { channel: CHANNEL, data } }),
  });
  if (!res.ok) throw new Error(`publish ${res.status}: ${await res.text()}`);
}

const results = {};
const trace = (m) => console.error('[trace]', m);
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout:' + label)), ms))]);

const assert = (name, ok, detalle) => {
  results[name] = { ok, ...(detalle ? { detalle } : {}) };
};

(async () => {
  // ── Cliente A (participante) ──
  const client = new Centrifuge(WS_URL, { token: connToken('user_A') });
  const received = [];
  const connectA = new Promise((r) => client.once('connected', r));
  client.connect();
  await withTimeout(connectA, 5000, 'connectA');
  trace('A conectado');

  const sub = client.newSubscription(CHANNEL, { token: subToken('user_A', CHANNEL) });
  const subscribed = new Promise((r) => sub.once('subscribed', r));
  sub.on('publication', (ctx) => received.push(ctx.data));
  sub.subscribe();
  await withTimeout(subscribed, 5000, 'subscribeA');
  trace('A suscrito');
  assert('1_suscripcion_canal_conversacion', true);

  // ── Worker simulado: exactamente el shape de chatOutbox.ts ──
  await publish({
    eventId: 'msg:e2e-1',
    eventType: 'message.created',
    messageId: 'e2e-1',
    conversationId: CONV,
    senderId: 'user_B',
    content: '¿Sigue abierto?',
    type: 'TEXT',
    metadata: null,
    createdAt: new Date().toISOString(),
  });
  await publish({ eventId: 'typing:e2e', eventType: 'typing', senderId: 'user_B', at: Date.now() });
  await wait(800);
  trace('recibidos=' + received.length);

  const msg = received.find((d) => d?.eventType === 'message.created');
  assert('2_message_created_llega', Boolean(msg) && msg.messageId === 'e2e-1' && msg.content === '¿Sigue abierto?', {
    recibidos: received.length,
    type: msg?.type,
  });

  const typing = received.find((d) => d?.eventType === 'typing');
  assert('3_typing_llega', Boolean(typing) && typing.senderId === 'user_B');

  // ── Cliente C (tercero) NO puede entrar al canal sin su token ──
  const intruder = new Centrifuge(WS_URL, { token: connToken('user_C') });
  const intruderConnected = new Promise((r) => intruder.once('connected', r));
  intruder.connect();
  await withTimeout(intruderConnected, 5000, 'connectC');
  trace('C conectado');
  const subC = intruder.newSubscription(CHANNEL); // sin token
  let intruderSubscribed = false;
  subC.on('subscribed', () => { intruderSubscribed = true; });
  subC.subscribe();
  await wait(1500);
  assert('4_tercero_no_entra_sin_token', !intruderSubscribed, { estado: subC.state });

  // ── El cliente no publica ──
  trace('probando publish del cliente');
  let publishOutcome = 'publicado';
  try { await sub.publish({ hola: 1 }); } catch (err) { publishOutcome = `rechazado(${err?.code ?? 'err'})`; }
  assert('5_cliente_no_publica', publishOutcome !== 'publicado', { publishOutcome });

  sub.unsubscribe();
  client.disconnect();
  intruder.disconnect();

  const failed = Object.values(results).filter((r) => !r.ok);
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n${failed.length === 0 ? '✅ E2E OK' : '❌ E2E FALLÓ'} — ${Object.keys(results).length - failed.length}/${Object.keys(results).length}`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error('E2E abortado:', err?.message || err);
  process.exit(1);
});
