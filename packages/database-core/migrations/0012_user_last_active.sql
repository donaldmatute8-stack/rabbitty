-- Marca de actividad para no mandar push nativo cuando la app está abierta.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" timestamp;
