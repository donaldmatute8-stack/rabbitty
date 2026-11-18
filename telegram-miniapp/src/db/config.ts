/**
 * ── Configuración de conexión a PostgreSQL ────────────────────────────────
 *
 * Por qué existe este módulo:
 * `pg` NO falla cuando no recibe `connectionString` — cae silenciosamente a
 * `127.0.0.1:5432`. En Vercel no hay Postgres local, así que cada query revienta
 * con `ECONNREFUSED 127.0.0.1:5432` y en los logs parece un fallo de base de
 * datos en lugar de un error de configuración (pasó el 2026-11-17, durante la
 * rotación de Neon: el runtime quedó sin `RESTAURANT_DATABASE_URL` y el pedido
 * del cliente moría con "no se pudo completar").
 *
 * Qué hacemos cuando falta la URL en runtime desplegado:
 * - NO lanzamos al importar el módulo: eso tumbaba las rutas completas, incluso
 *   las que sólo usan la otra base, y convertía un fallo de configuración en un
 *   500 opaco.
 * - Dejamos un host centinela que no existe (`db-config-missing.invalid`). Las
 *   queries fallan con un DNS claro y las rutas que no tocan esa base siguen
 *   funcionando. `/api/health` reconoce el centinela y lo reporta como
 *   `config_missing` en vez de "base caída".
 * - En local se mantiene el fallback de `pg` a localhost (desarrollo).
 */

export const DB_CONFIG_SENTINEL_HOST = 'db-config-missing.invalid';

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

/**
 * ¿La URL necesita TLS?
 *
 * Se decide por el HOST, no por `NODE_ENV`. El criterio anterior
 * (`NODE_ENV === 'production'`) rompía `next start` contra Postgres local con
 * «The server does not support SSL connections» — y ahora el entorno local vive
 * en localhost, así que producción ya no es sinónimo de "fuera de la máquina".
 */
export function needsSsl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local'));
  } catch {
    return false;
  }
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
  /** Nombre de la variable de entorno que ganó (o el motivo de que no haya). */
  source: string;
  /** true si no había ninguna variable y estamos en runtime desplegado. */
  missing: boolean;
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
    if (!isDeployedRuntime()) {
      return { url: undefined, source: '(ninguna: fallback local de pg)', missing: false };
    }
    const names = candidates.map(([name]) => name).join(', ');
    console.error(
      `[DB_CONFIG] Falta la conexión a la base de datos de "${label}". ` +
        `Define una de estas variables de entorno: ${names}. ` +
        `Mientras tanto las queries de esta base fallarán contra ${DB_CONFIG_SENTINEL_HOST}.`,
    );
    return {
      url: `postgresql://db-config-missing@${DB_CONFIG_SENTINEL_HOST}:5432/db_config_missing`,
      source: `(FALTA: ${names})`,
      missing: true,
    };
  }

  const [source, value] = winner;
  return { url: stripSslMode(value), source, missing: false };
}

/** Deja en el log qué variable se usó y contra qué host (una vez por proceso). */
export function logDbResolution(label: string, resolved: ResolvedDbUrl): void {
  if (process.env.NODE_ENV === 'test') return;
  if (resolved.missing) return; // ya se gritó en resolveDbUrl
  console.log(`[DB_CONFIG] ${label}: ${resolved.source} → ${dbHost(resolved.url)}`);
}
