/**
 * ── Storage de media del chat (S3-compatible, Railway Bucket) ──
 *
 * Por qué existe: antes la voz se incrustaba en `metadata` (jsonb) y había un
 * tope de 200 KB. Los binarios NO van en Postgres: van al bucket y el mensaje
 * solo guarda la `key`.
 *
 * Privacidad: el bucket NO es público. Todo se sirve por
 * `/api/chat/media/<key>`, que valida que quien pide pertenece a la
 * conversación (la key empieza por `chat/<conversationId>/...`).
 *
 * View-once (fotos de una sola vista): el objeto se borra del bucket en cuanto
 * se sirve la primera vez y se marca `viewedAt` en el mensaje.
 */

import { AwsClient } from 'aws4fetch';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MEDIA_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

export interface MediaConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getMediaConfig(): MediaConfig | null {
  const endpoint = process.env.AWS_ENDPOINT_URL?.trim();
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.AWS_DEFAULT_REGION?.trim() || 'auto';
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

export function isMediaStorageConfigured(): boolean {
  return getMediaConfig() !== null;
}

function client(cfg: MediaConfig): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 's3',
    region: cfg.region,
  });
}

/** URL virtual-host: https://<bucket>.<host>/<key> */
function objectUrl(cfg: MediaConfig, key: string): string {
  const url = new URL(cfg.endpoint);
  return `${url.protocol}//${cfg.bucket}.${url.host}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function buildMediaKey(conversationId: string, mime: string): string {
  const ext = ALLOWED_MEDIA_TYPES[mime] ?? 'bin';
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `chat/${conversationId}/${id}.${ext}`;
}

/** ¿La key pertenece a esta conversación? (evita path traversal y fugas) */
export function keyBelongsToConversation(key: string, conversationId: string): boolean {
  if (!key.startsWith(`chat/${conversationId}/`)) return false;
  return !key.includes('..');
}

/**
 * Presupuesto de la subida/lectura. Antes, si el bucket no respondía, la
 * función de Vercel se quedaba colgada hasta el límite de 300 s; ahora falla
 * rápido y el cliente puede reintentar.
 */
const STORAGE_TIMEOUT_MS = 25_000;

export async function uploadObject(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const cfg = getMediaConfig();
  if (!cfg) throw new Error('MEDIA_STORAGE_NOT_CONFIGURED');

  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);

  // `AwsClient.fetch()` firma y reenvía un `Request` con el cuerpo: en el
  // runtime de Vercel ese cuerpo se emite como stream (Transfer-Encoding:
  // chunked) y S3/Tigris responde `411 MissingContentLength`. Firmamos la URL
  // y hacemos el PUT con el buffer y `Content-Length` explícito: el objeto
  // llega completo en un solo envío.
  const signed = await client(cfg).sign(objectUrl(cfg, key), {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': contentType },
  });

  const headers = new Headers(signed.headers);
  headers.set('Content-Length', String(bytes.byteLength));

  const res = await fetch(signed.url, {
    method: 'PUT',
    headers,
    body: bytes,
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`UPLOAD_FAILED ${res.status} ${text.slice(0, 120)}`);
  }
}

export async function getObject(key: string): Promise<Response> {
  const cfg = getMediaConfig();
  if (!cfg) throw new Error('MEDIA_STORAGE_NOT_CONFIGURED');
  return client(cfg).fetch(objectUrl(cfg, key), {
    method: 'GET',
    signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
  });
}

export async function deleteObject(key: string): Promise<void> {
  const cfg = getMediaConfig();
  if (!cfg) return;
  try {
    await client(cfg).fetch(objectUrl(cfg, key), { method: 'DELETE' });
  } catch {
    /* best-effort: si falla, el objeto queda huérfano (se limpia con un cron) */
  }
}
