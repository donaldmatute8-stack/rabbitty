-- Invariantes operativos (2026-11-16). Aditivo.
--
-- Guarda una foto de cada revisión y el estado de alerta por invariante, para
-- no repetir el mismo aviso cada 15 minutos (dedupe) y para poder ver la
-- evolución de un problema.

CREATE TABLE IF NOT EXISTS "ops_health_snapshots" (
  "id" text PRIMARY KEY,
  "checkedAt" timestamptz NOT NULL DEFAULT now(),
  "metric" text NOT NULL,
  "value" real,
  "status" text NOT NULL DEFAULT 'ok',          -- ok | warn | critical
  "detail" text
);

CREATE INDEX IF NOT EXISTS "ops_health_snapshots_metric_idx"
  ON "ops_health_snapshots" ("metric", "checkedAt" DESC);

CREATE TABLE IF NOT EXISTS "ops_alert_state" (
  "metric" text PRIMARY KEY,
  "status" text NOT NULL DEFAULT 'ok',
  "lastAlertAt" timestamptz,
  "lastOkAt" timestamptz,
  "detail" text
);
