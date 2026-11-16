-- Premios tangibles por reto de membresía, definidos por el negocio (2026-11-16)
CREATE TABLE IF NOT EXISTS "membership_mission_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "businessId" text NOT NULL REFERENCES "ownedBusinesses"("id") ON DELETE CASCADE,
  "missionId" text NOT NULL,          -- VISITS_WEEK | BENEFITS_MONTH | RENEWAL
  "label" text NOT NULL,              -- p. ej. "Upgrade de tamaño gratis"
  "description" text,                 -- condiciones / cómo se aplica
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mission_rewards_uq" ON "membership_mission_rewards" ("businessId","missionId");
