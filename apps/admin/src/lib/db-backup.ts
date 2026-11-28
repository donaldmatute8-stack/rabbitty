import { spawn } from "node:child_process";
import { AwsClient } from "aws4fetch";

/**
 * ── Respaldos lógicos de las bases (pg_dump + S3) ───────────────────────────
 *
 * Por qué existe: el plan Hobby de Neon guarda **6 horas** de historial
 * (instant restore). Pasado ese plazo, un `DELETE` o `DROP` accidental ya no se
 * puede deshacer. Este respaldo es la red que no depende del proveedor.
 *
 * Reglas:
 * - `pg_dump -Fc` (formato custom): restaurable con `pg_restore`, sin owners ni
 *   privilegios para poder restaurar en cualquier rol.
 * - Se guarda **fuera** de Neon (bucket S3-compatible), con prefijo por base.
 * - Se verifica la cabecera `PGDMP` antes de subir: un dump truncado no se
 *   registra como bueno.
 * - Retención por capas: 6 h (7 días), diario (30 días), mensual (12 meses).
 *   Al terminar cada corrida se limpia lo que excede la retención.
 */

export type BackupDb = "restaurant" | "core";

export type BackupResult = {
  db: BackupDb;
  ok: boolean;
  key?: string;
  bytes?: number;
  ms?: number;
  error?: string;
  pruned?: number;
};

const URL_VAR: Record<BackupDb, string> = {
  restaurant: "RESTAURANT_DATABASE_URL",
  core: "CORE_DATABASE_URL",
};

/** Cabecera de un archivo custom de pg_dump. */
const MAGIC = "PGDMP";
const MIN_BYTES = 5 * 1024; // un dump vacío no llega ni a esto

function s3Config() {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  const region = process.env.BACKUP_S3_REGION || "auto";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables BACKUP_S3_* (endpoint, bucket o credenciales)");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function client() {
  const cfg = s3Config();
  return {
    ...cfg,
    aws: new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      region: cfg.region,
      service: "s3",
    }),
    host: new URL(cfg.endpoint).host,
  };
}

const objectUrl = (host: string, bucket: string, key: string) =>
  `https://${bucket}.${host}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** Ejecuta pg_dump y devuelve el buffer completo (las bases son pequeñas: ~20 MB). */
function pgDump(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pg_dump", ["-Fc", "--no-owner", "--no-privileges", "--schema=public", url], {
      env: { ...process.env, PGSSLMODE: url.includes("localhost") ? "disable" : "require" },
    });

    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];

    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => errors.push(c));

    proc.on("error", (e) =>
      reject(
        new Error(
          `No pude ejecutar pg_dump (${e.message}). Revisa que el binario de Postgres esté en la imagen.`,
        ),
      ),
    );

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump salió con código ${code}: ${Buffer.concat(errors).toString().slice(0, 400)}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

function assertLooksLikeDump(buf: Buffer) {
  if (buf.length < MIN_BYTES) {
    throw new Error(`Dump sospechosamente pequeño (${buf.length} bytes). No se sube.`);
  }
  if (buf.subarray(0, MAGIC.length).toString("latin1") !== MAGIC) {
    throw new Error("El archivo no tiene la cabecera de pg_dump (PGDMP). No se sube.");
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Clave del objeto. Hay tres capas de retención:
 *   - cada 6 h   → db/<base>/6h/AAAA-MM-DDTHH.dump      (7 días)
 *   - una diaria → db/<base>/daily/AAAA-MM-DD.dump      (30 días)
 *   - una mensual→ db/<base>/monthly/AAAA-MM.dump       (12 meses)
 */
export function buildKeys(db: BackupDb, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours());
  const base = `db/${db}`;
  return {
    slot: `${base}/6h/${y}-${m}-${d}T${h}.dump`,
    daily: `${base}/daily/${y}-${m}-${d}.dump`,
    monthly: `${base}/monthly/${y}-${m}.dump`,
  };
}

async function put(aws: AwsClient, host: string, bucket: string, key: string, body: Buffer) {
  const res = await aws.fetch(objectUrl(host, bucket, key), {
    method: "PUT",
    body: new Uint8Array(body),
    headers: {
      "content-type": "application/octet-stream",
      // R2/S3 exigen Content-Length explícito para cuerpos binarios; sin él
      // responden 411 MissingContentLength y el respaldo no se sube.
      "content-length": String(body.byteLength),
    },
  });
  if (!res.ok) {
    throw new Error(`S3 PUT ${key} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

/** Lista con prefijo y devuelve [{key, lastModified}]. XML simple, sin dependencias. */
async function list(
  aws: AwsClient,
  host: string,
  bucket: string,
  prefix: string,
): Promise<{ key: string; lastModified: Date }[]> {
  const url = `https://${bucket}.${host}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
  const res = await aws.fetch(url);
  if (!res.ok) return []; // si falla el listado, no rompemos la corrida por la limpieza
  const xml = await res.text();
  const out: { key: string; lastModified: Date }[] = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
    const lm = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)?.[1];
    if (!key) continue;
    out.push({ key: decodeURIComponent(key), lastModified: lm ? new Date(lm) : new Date(0) });
  }
  return out;
}

async function remove(aws: AwsClient, host: string, bucket: string, key: string) {
  await aws.fetch(objectUrl(host, bucket, key), { method: "DELETE" });
}

const RETENTION: { prefix: string; days: number }[] = [
  { prefix: "db/{db}/6h/", days: 7 },
  { prefix: "db/{db}/daily/", days: 30 },
  { prefix: "db/{db}/monthly/", days: 365 },
];

/** Borra los objetos que exceden la retención. Devuelve cuántos eliminó. */
export async function prune(db: BackupDb, now = new Date()): Promise<number> {
  const c = client();
  let removed = 0;
  for (const rule of RETENTION) {
    const prefix = rule.prefix.replace("{db}", db);
    const cutoff = now.getTime() - rule.days * 24 * 3600 * 1000;
    for (const obj of await list(c.aws, c.host, c.bucket, prefix)) {
      if (obj.lastModified.getTime() < cutoff) {
        await remove(c.aws, c.host, c.bucket, obj.key);
        removed++;
      }
    }
  }
  return removed;
}

export async function runBackup(db: BackupDb): Promise<BackupResult> {  const started = Date.now();
  const url = process.env[URL_VAR[db]];
  if (!url) {
    return { db, ok: false, error: `${URL_VAR[db]} no está configurada` };
  }

  try {
    const dump = await pgDump(url);
    assertLooksLikeDump(dump);

    const c = client();
    const now = new Date();
    const keys = buildKeys(db, now);

    // Slot de 6 h siempre; diaria y mensual cuando corresponde.
    await put(c.aws, c.host, c.bucket, keys.slot, dump);
    if (now.getUTCHours() === 0) await put(c.aws, c.host, c.bucket, keys.daily, dump);
    if (now.getUTCDate() === 1 && now.getUTCHours() === 0) {
      await put(c.aws, c.host, c.bucket, keys.monthly, dump);
    }

    const pruned = await prune(db, now).catch(() => 0);

    return { db, ok: true, key: keys.slot, bytes: dump.length, ms: Date.now() - started, pruned };
  } catch (e) {
    return {
      db,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    };
  }
}

/** Versión de las herramientas dentro del contenedor (diagnóstico). */
function runVersion(bin: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(bin, ["--version"]);
    let out = "";
    proc.stdout.on("data", (c: Buffer) => (out += c.toString()));
    proc.stderr.on("data", (c: Buffer) => (out += c.toString()));
    proc.on("error", (e) => resolve(`${bin}: no disponible (${e.message})`));
    proc.on("close", () => resolve(out.trim() || `${bin}: sin salida`));
  });
}

/**
 * Diagnóstico de `/api/cron/db-backup?check=1`: confirma que el binario existe
 * y qué versión es. `pg_dump` aborta si es más viejo que el servidor, así que
 * esto se revisa una vez por entorno en vez de descubrirlo con un respaldo roto.
 */
export async function toolVersions() {
  const [pgDump, pgRestore] = await Promise.all([runVersion("pg_dump"), runVersion("pg_restore")]);

  let server = "desconocido";
  const url = process.env.RESTAURANT_DATABASE_URL;
  if (url) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const r = await client.query("select version() as v");
      server = String(r.rows[0]?.v ?? "desconocido").slice(0, 80);
      await client.end();
    } catch (e) {
      server = e instanceof Error ? e.message.slice(0, 120) : "error";
    }
  }

  const dumpMajor = /(\d+)/.exec(pgDump)?.[1];
  const serverMajor = /PostgreSQL (\d+)/.exec(server)?.[1];
  const compatible = Boolean(dumpMajor && serverMajor && Number(dumpMajor) >= Number(serverMajor));

  return { pgDump, pgRestore, server, compatible };
}
