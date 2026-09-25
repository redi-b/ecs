export const PLATFORM_PRODUCTION_ENVIRONMENT = {
  NODE_ENV: "derived",
  SERVICE_NAME: "derived",
  PORT: "derived",
  PLATFORM_DATABASE_URL: "operator",
  PLATFORM_DATABASE_SSL: "operator",
  MEDUSA_DATABASE_URL: "operator",
  MEDUSA_DATABASE_SSL: "operator",
  REDIS_URL: "derived",
  MEDUSA_INTERNAL_URL: "derived",
  MEDUSA_ADMIN_API_TOKEN: "operator",
  PLATFORM_SECRETS_ENCRYPTION_KEY: "operator",
  PLATFORM_INTERNAL_API_TOKEN: "operator",
  PLATFORM_PUBLIC_BASE_URL: "derived",
  STOREFRONT_PUBLIC_BASE_DOMAIN: "derived",
  STOREFRONT_DEMO_HOST: "operator",
  STOREFRONT_CACHE_PURGE_SECRET: "operator",
  STOREFRONT_PREVIEW_SECRET: "operator",
  STOREFRONT_INTERNAL_BASE_URL: "derived",
  UMAMI_BASE_URL: "derived",
  UMAMI_USERNAME: "operator",
  UMAMI_PASSWORD: "operator",
  DASHBOARD_PUBLIC_BASE_URL: "derived",
  DASHBOARD_LEGACY_PUBLIC_BASE_URL: "derived",
  BETTER_AUTH_URL: "derived",
  BETTER_AUTH_SECRET: "operator",
  GOOGLE_AUTH_ENABLED: "operator",
  GOOGLE_CLIENT_ID: "operator",
  GOOGLE_CLIENT_SECRET: "operator",
  BETTER_AUTH_COOKIE_DOMAIN: "derived",
  BETTER_AUTH_COOKIE_PREFIX: "operator",
  BETTER_AUTH_TRUSTED_ORIGINS: "derived",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "derived",
  MEDIA_STORAGE_PROVIDER: "derived",
  MEDIA_S3_ENDPOINT: "operator",
  MEDIA_S3_INTERNAL_ENDPOINT: "operator",
  MEDIA_S3_REGION: "operator",
  MEDIA_S3_BUCKET: "operator",
  MEDIA_S3_ACCESS_KEY_ID: "operator",
  MEDIA_S3_SECRET_ACCESS_KEY: "operator",
  MEDIA_S3_PUBLIC_BASE_URL: "operator",
  MEDIA_S3_FORCE_PATH_STYLE: "operator",
  MEDIA_UPLOAD_URL_TTL_SECONDS: "derived",
  TELEGRAM_BOT_TOKEN: "operator",
  TELEGRAM_BOT_USERNAME: "operator",
  TELEGRAM_WEBHOOK_SECRET: "operator",
  EMAIL_PROVIDER: "operator",
  RESEND_API_KEY: "operator",
  EMAIL_FROM: "operator",
  EMAIL_FROM_ACCOUNTS: "operator",
  EMAIL_FROM_ORDERS: "operator",
  EMAIL_FROM_BILLING: "operator",
  EMAIL_FROM_NOTIFICATIONS: "operator",
  EMAIL_REPLY_TO_SUPPORT: "operator",
  EMAIL_DELIVERY_ENCRYPTION_KEY: "operator",
  CHAPA_SECRET_KEY: "operator",
  CHAPA_API_URL: "operator",
  CHAPA_FALLBACK_EMAIL: "operator",
  BILLING_RECONCILE_INTERVAL_MS: "operator",
  BILLING_LIFECYCLE_INTERVAL_MS: "operator",
  PLATFORM_BILLING_TELEBIRR_NAME: "operator",
  PLATFORM_BILLING_TELEBIRR_ACCOUNT: "operator",
  PLATFORM_BILLING_CBE_NAME: "operator",
  PLATFORM_BILLING_CBE_ACCOUNT: "operator",
  LINKS_ET_API_KEY: "operator",
} as const;

export type PlatformProductionEnvironmentKey = keyof typeof PLATFORM_PRODUCTION_ENVIRONMENT;

const REQUIRED = [
  "PLATFORM_DATABASE_URL",
  "MEDUSA_DATABASE_URL",
  "REDIS_URL",
  "MEDUSA_INTERNAL_URL",
  "PLATFORM_INTERNAL_API_TOKEN",
  "PLATFORM_PUBLIC_BASE_URL",
  "STOREFRONT_PUBLIC_BASE_DOMAIN",
  "STOREFRONT_CACHE_PURGE_SECRET",
  "STOREFRONT_PREVIEW_SECRET",
  "STOREFRONT_INTERNAL_BASE_URL",
  "DASHBOARD_PUBLIC_BASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_COOKIE_DOMAIN",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "MEDIA_STORAGE_PROVIDER",
  "MEDIA_S3_ENDPOINT",
  "MEDIA_S3_INTERNAL_ENDPOINT",
  "MEDIA_S3_BUCKET",
  "MEDIA_S3_ACCESS_KEY_ID",
  "MEDIA_S3_SECRET_ACCESS_KEY",
  "MEDIA_S3_PUBLIC_BASE_URL",
  "EMAIL_PROVIDER",
] as const satisfies readonly PlatformProductionEnvironmentKey[];

const PUBLIC_URLS = [
  "PLATFORM_PUBLIC_BASE_URL",
  "DASHBOARD_PUBLIC_BASE_URL",
  "BETTER_AUTH_URL",
  "MEDIA_S3_ENDPOINT",
  "MEDIA_S3_PUBLIC_BASE_URL",
] as const satisfies readonly PlatformProductionEnvironmentKey[];

function present(env: NodeJS.ProcessEnv, key: PlatformProductionEnvironmentKey) {
  return env[key]?.trim() ?? "";
}

export function assertPlatformProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  for (const key of REQUIRED) {
    if (!present(env, key)) errors.push(`${key} is required`);
  }
  for (const key of PUBLIC_URLS) {
    const value = present(env, key);
    if (value && !value.startsWith("https://")) errors.push(`${key} must use https://`);
  }

  const googleMode = present(env, "GOOGLE_AUTH_ENABLED") || "auto";
  const googleClientId = present(env, "GOOGLE_CLIENT_ID");
  const googleClientSecret = present(env, "GOOGLE_CLIENT_SECRET");
  if (!(["auto", "true", "false"] as const).includes(googleMode as "auto" | "true" | "false")) {
    errors.push("GOOGLE_AUTH_ENABLED must be auto, true, or false");
  }
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    errors.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
  }
  if (googleMode === "true" && (!googleClientId || !googleClientSecret)) {
    errors.push("Google authentication is enabled but its credentials are missing");
  }

  const emailProvider = present(env, "EMAIL_PROVIDER");
  if (emailProvider === "resend") {
    for (const key of [
      "RESEND_API_KEY",
      "EMAIL_FROM_ACCOUNTS",
      "EMAIL_FROM_ORDERS",
      "EMAIL_FROM_BILLING",
      "EMAIL_FROM_NOTIFICATIONS",
    ] as const) {
      if (!present(env, key)) errors.push(`${key} is required when EMAIL_PROVIDER=resend`);
    }
  }

  if (present(env, "AUTH_REQUIRE_EMAIL_VERIFICATION") !== "true") {
    errors.push("AUTH_REQUIRE_EMAIL_VERIFICATION must be true in production");
  }
  if (present(env, "MEDIA_STORAGE_PROVIDER") !== "s3") {
    errors.push("MEDIA_STORAGE_PROVIDER must be s3 in production");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid Platform production environment:
- ${errors.join("\n- ")}`);
  }
}
