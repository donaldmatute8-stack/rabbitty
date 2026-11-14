-- 0058 · Preferencia de notificaciones por email (app móvil)
-- Aditiva: columna con default false. Sin ella, nada cambia.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailNotifications" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN users."emailNotifications" IS
  'El usuario quiere recibir por correo los avisos importantes (Resend).';

COMMIT;
