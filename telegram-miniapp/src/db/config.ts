/**
 * ── Configuración de conexión a PostgreSQL (fail-fast) ──
 *
 * Por qué existe este módulo:
 * `pg` NO falla cuando no recibe `connectionString` — cae silenciosamente a
 * `127.0.0.1:5432`. En Vercel no hay Postgres local, así que cada query revienta
 * con `ECONNREFUSED 127.0.0.1:5432` y en los logs parece un fallo de base de
 * datos en lugar de un error de configuración (pasó el 2026-11-17, durante la
 * rotación de Neon: la app quedó sin `DATABASE_URL` en el runtime y todos los
 * endpoints del cliente fallaron, incluido el checkout).
 *
 * Reglas:
 * - En runtime desplegado (Vercel o NODE_ENV=production) la falta de URL es un
 *   error de configuración explícito: preferimos un log claro a 40 líneas de
 *   stack trace apuntando a localhost.
 * - En local se mantiene el fallback de `pg` (un Postgres en localhost es un
 *   escenario de desarrollo legítimo).
 * - Durante `next build` no lanzamos: el build no necesita la base y no
 *   queremos romperlo por una variable que sólo se usa en runtime.
 */

// Strip `sslmode` from the connection string: pg-connection-string v2.9+ warns
// that 'require'/'prefer' are aliases for 'verify-full' and will change in v3.
// TLS is configured explicitly where the pool is created, so the query param is
// redundant.
export function stripSslMode(raw?: string): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('sslmode')) return raw;
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw;
  }
}

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build'
  );
}

function isDeployedRuntime(): boolean {
  if (isBuildPhase()) return false;
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

/** Host de la URL, sin credenciales — lo único que es seguro loggear. */
export function dbHost(url?: string): string {
  if (!url) return '(sin URL)';
  try {
    return new URL(url).host;
  } catch {
    return '(URL inválida)';
  }
}

export type ResolvedDbUrl = {
  url?: string;
  /** Nombre de la variable de entorno que ganó (o `(ninguna)`). */
  source: string;
};

/**
 * Resuelve la URL probando las variables en orden de prioridad.
 * La PRIMERA definida gana — una variable vieja con prioridad alta gana en
 * silencio, que es exactamente la trampa que queremos ver en logs.
 */
export function resolveDbUrl(
  candidates: Array<[name: string, value: string | undefined]>,
  label: string,
): ResolvedDbUrl {
  const winner = candidates.find(([, value]) => value && value.trim().length > 0);

  if (!winner) {
    if (isDeployedRuntime()) {
      const names = candidates.map(([name]) => name).join(', ');
      throw new Error(
        `[DB_CONFIG] Falta la conexión a la base de datos de "${label}". ` +
          `Define una de estas variables de entorno: ${names}. ` +
          `Sin ella, \`pg\` cae a 127.0.0.1:5432 y todas las queries fallan con ECONNREFUSED.`,
      );
    }
    return { url: undefined, source: '(ninguna: fallback local de pg)' };
  }

  const [source, value] = winner;
  return { url: stripSslMode(value), source };
}

/**
 * ¿Hay al menos una variable definida? No lanza: lo usa `/api/health`, que debe
 * poder REPORTAR la falta de configuración en lugar de morir al importar `@/db`.
 */
export function hasAnyDbUrl(...values: Array<string | undefined>): boolean {
  return values.some((value) => typeof value === 'string' && value.trim().length > 0);
}

/** Deja en el log qué variable se usó y contra qué host (una vez por proceso). */
export function logDbResolution(label: string, resolved: ResolvedDbUrl): void {
  if (process.env.NODE_ENV === 'test') return;
  console.log(
    `[DB_CONFIG] ${label}: ${resolved.source} → ${dbHost(resolved.url)}`,
  );
}
