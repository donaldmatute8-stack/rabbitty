/**
 * ── Storage de media (S3-compatible, Railway Bucket) ──────────────────────
 *
 * Helper genérico que comparten la mensajería y las fotos de producto. Antes
 * vivía solo en la app del cliente; al necesitarlo el admin, se trae aquí para
 * no tener dos firmas distintas de S3.
 *
 * El bucket NO es público: cada consumidor decide cómo sirve la key.
 * - Chat: `/api/chat/media/<key>` valida pertenencia a la conversación.
 * - Producto: `/api/media/product/<key>` es público (lo ve cualquiera que abra
 *   la ficha del negocio), con cache larga e immutable.
 */

import { AwsClient } from 'aws4fetch';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB

export const IMAGE_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
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

/** Key estable y sin colisiones para la foto de un producto. */
export function buildProductImageKey(branchId: string, mime: string): string {
  const ext = IMAGE_TYPES[mime] ?? 'jpg';
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `menu/${branchId}/${id}.${ext}`;
}

/**
 * Saca la key de una URL servida por `/api/media/product/<key>`.
 * Devuelve null si la URL no es nuestra (foto externa, dataURL viejo…), para no
 * borrar objetos ajenos por accidente.
 */
export function productImageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/api/media/product/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const key = url.slice(idx + marker.length).split("?")[0] ?? "";
  return key && isProductImageKey(key) ? key : null;
}

/** ¿La key es una foto de producto válida? (evita saltar a otras carpetas) */
export function isProductImageKey(key: string): boolean {
  return /^menu\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(key);
}

const STORAGE_TIMEOUT_MS = 25_000;

export async function uploadObject(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const cfg = getMediaConfig();
  if (!cfg) throw new Error('MEDIA_STORAGE_NOT_CONFIGURED');

  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);

  // Firmamos la URL y hacemos el PUT con `Content-Length` explícito: con el
  // cuerpo en stream, S3/Tigris responde 411 MissingContentLength.
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
    /* best-effort: si falla, el objeto queda huérfano */
  }
}
