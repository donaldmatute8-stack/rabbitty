/**
 * ── chatCursor ── Cursor compuesto estable (createdAt, id) para paginación y
 * delta de conversaciones (plan RABBITTY-MENSAJES-PLAN §4 · Fase 0.2/0.3).
 * Contrato compartido: lo consumen las rutas HTTP de la miniapp y el cliente.
 *
 * Por qué compuesto y no `lastMessageId`: el id (uuid v4) NO representa orden
 * cronológico y los `createdAt` pueden empatar — el desempate por id da un
 * orden total reproducible. El cursor solo AVANZA cuando el cliente ya
 * procesó los mensajes (política del caller), no al recibir la respuesta.
 *
 * Formato: `v1:<epochMs>:<id>` — URL-safe y con versión para evolucionar.
 */

export interface ChatCursor {
  createdAt: string; // ISO
  id: string;
}

const PREFIX = "v1";

export function encodeChatCursor(c: ChatCursor): string {
  if (!c?.createdAt || !c?.id) return "";
  return `${PREFIX}:${new Date(c.createdAt).getTime()}:${c.id}`;
}

export function decodeChatCursor(raw: string | null | undefined): ChatCursor | null {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const ms = Number(parts[1]);
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  const id = parts[2];
  if (!id) return null;
  return { createdAt: iso, id };
}

/** Cursor de un mensaje (lo pinta el caller al confirmar lectura en el cliente). */
export function cursorFromMessage(m: { createdAt: string | Date; id: string }): string {
  const createdAt = typeof m.createdAt === "string" ? m.createdAt : m.createdAt.toISOString();
  return encodeChatCursor({ createdAt, id: m.id });
}
