/**
 * ── Descripción de errores de infraestructura para logs ───────────────────
 *
 * Drizzle (y `pg` debajo) envuelven el error real: `err.message` queda como
 * `Failed query: select 1` y la causa verdadera (`ECONNREFUSED 127.0.0.1:5432`,
 * `database "x" does not exist`, `password authentication failed`) vive en
 * `err.cause`. En los logs de Vercel del 17-nov eso obligó a leer 40 líneas de
 * stack para encontrar el `ECONNREFUSED`; esto lo deja en una sola línea.
 *
 * No sustituye al stack: se usa en el `console.*` del servidor, nunca en la
 * respuesta al usuario.
 */
export function describeError(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  const seen = new Set<unknown>();

  while (current && !seen.has(current) && parts.length < 4) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      const suffix = typeof code === "string" ? ` [${code}]` : "";
      const message = current.message.trim();
      if (message && !parts.includes(message)) parts.push(`${message}${suffix}`);
      current = (current as { cause?: unknown }).cause;
    } else {
      const message = String(current);
      if (message && !parts.includes(message)) parts.push(message);
      break;
    }
  }

  if (parts.length === 0) return "error desconocido";
  // `Failed query: …` primero y la causa real después; separadas por " ← ".
  return parts.join(" ← ");
}
