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

import {
  deleteObject as deleteSharedObject,
  getMediaConfig,
  getObject as getSharedObject,
  isMediaStorageConfigured,
  uploadObject as uploadSharedObject,
} from '@rabbitty/api/services/mediaStorage';

export { getMediaConfig, isMediaStorageConfigured };

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
/**
 * Sube un objeto al bucket. Toda la firma y el manejo de `Content-Length` viven
 * en `@rabbitty/api/services/mediaStorage` (lo comparte la tienda de productos).
 */
export async function uploadObject(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  return uploadSharedObject(key, body, contentType);
}

export async function getObject(key: string): Promise<Response> {
  return getSharedObject(key);
}

export async function deleteObject(key: string): Promise<void> {
  return deleteSharedObject(key);
}
