-- 0031 · Índice del barrido de canjes vencidos
--
-- El worker de notificaciones corre cada 5 min y expira canjes con
-- `status='RESERVED' AND "expiresAt" <= now()`. Sin este índice la consulta
-- recorre toda la tabla en cada corrida (coste innecesario en Neon/Vercel).
-- Aditiva e idempotente.

CREATE INDEX IF NOT EXISTS "offer_redemptions_expiry_idx"
  ON "offer_redemptions" ("status", "expiresAt");
