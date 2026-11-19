-- ── Historial de comisión de plataforma ────────────────────────────────────
--
-- Quién cambió la tarifa, cuándo y a qué valor. La comisión es ingreso de
-- Rabbitty y hoy sólo la escribe God; sin este registro un cambio de 3.8 % a
-- 0.5 % no dejaba rastro. Se guarda cada cambio (no sólo el último) porque es
-- material para auditoría y para responder reclamos del afiliado.

CREATE TABLE IF NOT EXISTS "platform_commission_history" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL,
  "businessId" text,
  "enabled" boolean NOT NULL,
  "pct" real NOT NULL,
  "appliesTo" text NOT NULL DEFAULT 'APP_ORDERS',
  "minFeeMxn" real NOT NULL DEFAULT 0,
  "actorId" text,
  "actorEmail" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "platform_commission_history_idx"
  ON "platform_commission_history" ("restaurantId", "createdAt" DESC);

COMMENT ON TABLE "platform_commission_history" IS
  'Bitácora de cambios de la comisión de plataforma (quién, cuándo, qué tarifa)';
