import assert from "node:assert/strict";
import { test } from "node:test";

import { validateProductionEnvironment } from "./validate-production-env.mjs";

const secret = (label) => `${label}-${"x".repeat(40)}`;
const validEnvironment = () => ({
  IMAGE_PREFIX: "ghcr.io/acme/ecs",
  IMAGE_TAG: "sha-0123456789abcdef0123456789abcdef01234567",
  BASE_DOMAIN: "ecs.acme.test",
  SUPERADMIN_PUBLIC_BASE_URL: "https://ops.ecs.acme.test",
  STOREFRONT_DEMO_HOST: "demo.ecs.acme.test",
  POSTGRES_PASSWORD: secret("postgres"),
  PLATFORM_DATABASE_URL: `postgres://ecs:${secret("postgres")}@postgres:5432/platform_db`,
  MEDUSA_DATABASE_URL: `postgres://ecs:${secret("postgres")}@postgres:5432/medusa_db`,
  PLATFORM_INTERNAL_API_TOKEN: secret("internal"),
  BETTER_AUTH_SECRET: secret("auth"),
  GOOGLE_AUTH_ENABLED: "true",
  GOOGLE_CLIENT_ID: "google-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: secret("google"),
  STOREFRONT_CACHE_PURGE_SECRET: secret("purge"),
  STOREFRONT_PREVIEW_SECRET: secret("preview"),
  MEDUSA_JWT_SECRET: secret("jwt"),
  MEDUSA_COOKIE_SECRET: secret("cookie"),
  MEDIA_S3_SECRET_ACCESS_KEY: secret("media"),
  UMAMI_APP_SECRET: secret("umami"),
  MEDIA_S3_ENDPOINT: "https://media.ecs.acme.test",
  MEDIA_S3_PUBLIC_BASE_URL: "https://media.ecs.acme.test/ecs-media",
  MEDIA_S3_CORS_ALLOW_ORIGIN: "*",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: secret("resend"),
  EMAIL_FROM_ACCOUNTS: "ECS Accounts <accounts@ecs.acme.test>",
  EMAIL_FROM_BILLING: "ECS Billing <billing@ecs.acme.test>",
  EMAIL_FROM_NOTIFICATIONS: "ECS Notifications <notifications@ecs.acme.test>",
  EMAIL_FROM_ORDERS: "ECS Orders <orders@ecs.acme.test>",
  EMAIL_DELIVERY_ENCRYPTION_KEY: "email-delivery-key-at-least-32-characters",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
});

test("accepts a coherent production environment", () => {
  assert.deepEqual(validateProductionEnvironment(validEnvironment()), { errors: [], warnings: [] });
});

test("rejects placeholders, reused secrets, database drift, and partial providers", () => {
  const environment = validEnvironment();
  environment.BASE_DOMAIN = "ecs.example.com";
  environment.BETTER_AUTH_SECRET = environment.PLATFORM_INTERNAL_API_TOKEN;
  environment.MEDUSA_DATABASE_URL = environment.PLATFORM_DATABASE_URL;
  environment.EMAIL_FROM_ACCOUNTS = "";

  const { errors } = validateProductionEnvironment(environment);
  assert.ok(errors.some((error) => error.includes("BASE_DOMAIN still contains a placeholder")));
  assert.ok(errors.some((error) => error.includes("must not reuse")));
  assert.ok(errors.some((error) => error.includes("separate databases")));
  assert.ok(errors.some((error) => error.includes("EMAIL_FROM_ACCOUNTS")));
});

test("rejects an email provider without an installed adapter", () => {
  const environment = validEnvironment();
  environment.EMAIL_PROVIDER = "smtp";

  const { errors } = validateProductionEnvironment(environment);
  assert.ok(errors.some((error) => error.includes("has no installed adapter")));
});

test("rejects missing Google OAuth credentials when enabled", () => {
  const environment = validEnvironment();
  environment.GOOGLE_CLIENT_ID = "";
  environment.GOOGLE_CLIENT_SECRET = "";

  const { errors } = validateProductionEnvironment(environment);
  assert.ok(errors.some((error) => error.includes("GOOGLE_CLIENT_ID")));
  assert.ok(errors.some((error) => error.includes("GOOGLE_CLIENT_SECRET")));
});

test("allows Google OAuth to be explicitly disabled", () => {
  const environment = validEnvironment();
  environment.GOOGLE_AUTH_ENABLED = "false";
  environment.GOOGLE_CLIENT_ID = "";
  environment.GOOGLE_CLIENT_SECRET = "";

  assert.deepEqual(validateProductionEnvironment(environment), { errors: [], warnings: [] });
});

test("warns when the deployment uses a mutable image tag", () => {
  const environment = validEnvironment();
  environment.IMAGE_TAG = "main";
  const { errors, warnings } = validateProductionEnvironment(environment);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});

test("rejects operations and demo hosts outside the platform domain", () => {
  const environment = validEnvironment();
  environment.SUPERADMIN_PUBLIC_BASE_URL = "https://ops.other.test/path";
  environment.STOREFRONT_DEMO_HOST = "preview.other.test";

  const { errors } = validateProductionEnvironment(environment);
  assert.ok(errors.some((error) => error.includes("SUPERADMIN_PUBLIC_BASE_URL must be")));
  assert.ok(errors.some((error) => error.includes("STOREFRONT_DEMO_HOST must be")));
});
