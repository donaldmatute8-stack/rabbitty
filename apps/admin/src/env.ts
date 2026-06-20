function required(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Check apps/admin/.env.local or your platform environment variables.`
    );
  }
  return value;
}

function optional(key: string, value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export function getEnv() {
  return {
    CORE_DATABASE_URL: required("CORE_DATABASE_URL", process.env.CORE_DATABASE_URL),
    RESTAURANT_DATABASE_URL: required("RESTAURANT_DATABASE_URL", process.env.RESTAURANT_DATABASE_URL),
    AUTH_SECRET: required("AUTH_SECRET", process.env.AUTH_SECRET),
    BRANCH_ID: required("BRANCH_ID", process.env.BRANCH_ID),
    RABBITTY_MINIAPP_URL: required("RABBITTY_MINIAPP_URL", process.env.RABBITTY_MINIAPP_URL),
    RABBITTY_API_SECRET: required("RABBITTY_API_SECRET", process.env.RABBITTY_API_SECRET),
    ENCRYPTION_KEY: required("ENCRYPTION_KEY", process.env.ENCRYPTION_KEY),
    NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3003"),
    NEXT_PUBLIC_BRANCH_ID: optional("NEXT_PUBLIC_BRANCH_ID", process.env.NEXT_PUBLIC_BRANCH_ID, "b1"),
    AUTH_TELEGRAM_BOT_TOKEN: optional("AUTH_TELEGRAM_BOT_TOKEN", process.env.AUTH_TELEGRAM_BOT_TOKEN, ""),
    RP_NAME: optional("RP_NAME", process.env.RP_NAME, "Rabbitty Admin"),
    RP_ID: optional("RP_ID", process.env.RP_ID, "localhost"),
    ORIGIN: optional("ORIGIN", process.env.ORIGIN, "http://localhost:3003"),
    CRON_SECRET: optional("CRON_SECRET", process.env.CRON_SECRET, ""),
    AGGREGATOR_WEBHOOK_SECRET: optional("AGGREGATOR_WEBHOOK_SECRET", process.env.AGGREGATOR_WEBHOOK_SECRET, ""),
  };
}
