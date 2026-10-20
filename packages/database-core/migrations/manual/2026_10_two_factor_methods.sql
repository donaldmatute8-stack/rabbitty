-- Aditivo e idempotente: 2FA por OTP (email/teléfono). TOTP ya existía (totpSecret/totpEnabled).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorMethods" text DEFAULT '[]' NOT NULL;
