-- Historial de despliegues vistos por la aplicación (2026-11-16). Aditivo.
--
-- El watchdog de rollback necesita saber a qué commit volver. Los tokens de
-- proyecto de Railway NO pueden consultar `deployments` por GraphQL, así que la
-- app lleva su propio registro: cada arranque anota el commit en el que corre.
-- El "commit anterior" es el más reciente de esta tabla distinto del actual.

CREATE TABLE IF NOT EXISTS "ops_deploy_history" (
  "commit" text PRIMARY KEY,
  "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ops_deploy_history_seen_idx"
  ON "ops_deploy_history" ("firstSeenAt" DESC);
