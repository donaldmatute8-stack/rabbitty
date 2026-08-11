function optional(key: string, value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export function getEnv() {
  // NOTE: Los fallbacks son SOLO para desarrollo local. Nunca deben contener
  // credenciales reales de producción. En prod (Railway) las variables de
  // entorno se inyectan y estos valores nunca se usan.
  const dbFallback = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgresql://rabbitty:rabbitty_dev@localhost:5432/rabbitty_core";
  const authSecretFallback = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-auth-secret-not-for-production";
  const apiSecretFallback = process.env.RABBITTY_API_SECRET || "dev-only-rabbitty-api-secret-not-for-production";
  const encryptionKeyFallback = process.env.ENCRYPTION_KEY || "dev-only-encryption-key-not-for-production-0000000000000000";

  return {
    CORE_DATABASE_URL: optional("CORE_DATABASE_URL", process.env.CORE_DATABASE_URL, dbFallback),
    RESTAURANT_DATABASE_URL: optional("RESTAURANT_DATABASE_URL", process.env.RESTAURANT_DATABASE_URL, dbFallback),
    AUTH_SECRET: optional("AUTH_SECRET", process.env.AUTH_SECRET, authSecretFallback),
    BRANCH_ID: optional("BRANCH_ID", process.env.BRANCH_ID, process.env.NEXT_PUBLIC_BRANCH_ID || "b1"),
    RABBITTY_MINIAPP_URL: optional("RABBITTY_MINIAPP_URL", process.env.RABBITTY_MINIAPP_URL, "https://rabbitty.me"),
    RABBITTY_API_SECRET: optional("RABBITTY_API_SECRET", process.env.RABBITTY_API_SECRET, apiSecretFallback),
    ENCRYPTION_KEY: optional("ENCRYPTION_KEY", process.env.ENCRYPTION_KEY, encryptionKeyFallback),
    NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL, "https://admin.rabbitty.me"),
    NEXT_PUBLIC_BRANCH_ID: optional("NEXT_PUBLIC_BRANCH_ID", process.env.NEXT_PUBLIC_BRANCH_ID, "b1"),
    AUTH_TELEGRAM_BOT_TOKEN: optional("AUTH_TELEGRAM_BOT_TOKEN", process.env.AUTH_TELEGRAM_BOT_TOKEN, ""),
    RP_NAME: optional("RP_NAME", process.env.RP_NAME, "Rabbitty Admin"),
    RP_ID: optional("RP_ID", process.env.RP_ID, "rabbitty.me"),
    ORIGIN: optional("ORIGIN", process.env.ORIGIN, "https://admin.rabbitty.me"),
    CRON_SECRET: optional("CRON_SECRET", process.env.CRON_SECRET, ""),
    AGGREGATOR_WEBHOOK_SECRET: optional("AGGREGATOR_WEBHOOK_SECRET", process.env.AGGREGATOR_WEBHOOK_SECRET, ""),
  };
}
