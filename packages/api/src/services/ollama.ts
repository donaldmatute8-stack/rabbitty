/**
 * ── Ollama: URL y cabeceras normalizadas ────────────────────────────────
 * `OLLAMA_BASE_URL` se ha configurado de varias formas:
 *   http://host:11434          → hay que añadir /api/chat
 *   https://ollama.com/api     → NO hay que duplicar /api (antes daba 404)
 *   https://host/api/chat      → ya es el endpoint completo
 *
 * Este helper evita el clásico `/api/api/chat` y añade la API key cuando el
 * proveedor la exige (Ollama Cloud).
 */

export type OllamaPath = "/api/chat" | "/api/generate" | "/api/tags";

export function ollamaEndpoint(base: string | undefined | null, path: OllamaPath): string | null {
  const trimmed = (base || "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // Ya es un endpoint completo.
  if (/\/(api\/(chat|generate|tags))$/.test(trimmed)) return trimmed;

  // Base con /api (Ollama Cloud): solo falta el recurso.
  if (/\/api$/.test(trimmed)) return `${trimmed}${path.replace(/^\/api/, "")}`;

  // Base tipo host:11434.
  return `${trimmed}${path}`;
}

export function ollamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.OLLAMA_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/** Mensaje de error legible con el body del proveedor (recortado). */
export async function ollamaErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return clean ? `: ${clean}` : "";
}
