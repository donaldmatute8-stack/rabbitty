-- ── Índice para el drop de Rabbit Chair ─────────────────────────────────────
-- La audiencia del lanzamiento se resuelve por negocio + última presencia.
-- Sin este índice, la consulta escanea toda la tabla de presencia.
--
-- Aditiva.

CREATE INDEX IF NOT EXISTS "presenceSessions_business_ping_idx"
  ON "presenceSessions" ("businessId", "lastPingAt" DESC);
