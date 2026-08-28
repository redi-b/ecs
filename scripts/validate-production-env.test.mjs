import assert from "node:assert/strict";
import { test } from "node:test";

import { validateProductionEnvironment } from "./validate-production-env.mjs";

const secret = (label) => `${label}-${"x".repeat(40)}`;
const validEnvironment = () => ({
  IMAGE_PREFIX: "ghcr.io/acme/ecs",
  IMAGE_TAG: "sha-0123456789abcdef0123456789abcdef01234567",
  BASE_DOMAIN: "ecs.acme.test",
  POSTGRES_PASSWORD: secret("postgres"),
  PLATFORM_DATABASE_URL: `postgres://ecs:${secret("postgres")}@postgres:5432/platform_db`,
  MEDUSA_DATABASE_URL: `postgres://ecs:${secret("postgres")}@postgres:5432/medusa_db`,
  PLATFORM_INTERNAL_API_TOKEN: secret("internal"),
  BETTER_AUTH_SECRET: secret("auth"),
  STOREFRONT_CACHE_PURGE_SECRET: secret("purge"),
  STOREFRONT_PREVIEW_SECRET: secret("preview"),
  MEDUSA_JWT_SECRET: secret("jwt"),
  MEDUSA_COOKIE_SECRET: secret("cookie"),
  MEDIA_S3_SECRET_ACCESS_KEY: secret("media"),
  MEDIA_S3_ENDPOINT: "https://media.ecs.acme.test",
  MEDIA_S3_PUBLIC_BASE_URL: "https://media.ecs.acme.test/ecs-media",
  MEDIA_S3_CORS_ALLOW_ORIGIN: "https://dashboard.ecs.acme.test",
});

test("accepts a coherent production environment", () => {
  assert.deepEqual(validateProductionEnvironment(validEnvironment()), { errors: [], warnings: [] });
});

test("rejects placeholders, reused secrets, database drift, and partial providers", () => {
  const environment = validEnvironment();
  environment.BASE_DOMAIN = "ecs.example.com";
  environment.BETTER_AUTH_SECRET = environment.PLATFORM_INTERNAL_API_TOKEN;
  environment.MEDUSA_DATABASE_URL = environment.PLATFORM_DATABASE_URL;
  environment.RESEND_API_KEY = "configured-without-sender";

  const { errors } = validateProductionEnvironment(environment);
  assert.ok(errors.some((error) => error.includes("BASE_DOMAIN still contains a placeholder")));
  assert.ok(errors.some((error) => error.includes("must not reuse")));
  assert.ok(errors.some((error) => error.includes("separate databases")));
  assert.ok(errors.some((error) => error.includes("configured together")));
});

test("warns when the deployment uses a mutable image tag", () => {
  const environment = validEnvironment();
  environment.IMAGE_TAG = "main";
  const { errors, warnings } = validateProductionEnvironment(environment);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});
