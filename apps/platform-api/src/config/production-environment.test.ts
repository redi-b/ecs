import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PLATFORM_PRODUCTION_ENVIRONMENT,
  assertPlatformProductionEnvironment,
} from "./production-environment.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PLATFORM_DATABASE_URL: "postgres://ecs:secret@postgres:5432/platform_db",
  MEDUSA_DATABASE_URL: "postgres://ecs:secret@postgres:5432/medusa_db",
  REDIS_URL: "redis://redis:6379",
  MEDUSA_INTERNAL_URL: "http://medusa:9000",
  PLATFORM_INTERNAL_API_TOKEN: "internal-secret",
  PLATFORM_PUBLIC_BASE_URL: "https://api.example.com",
  STOREFRONT_PUBLIC_BASE_DOMAIN: "example.com",
  STOREFRONT_CACHE_PURGE_SECRET: "purge-secret",
  STOREFRONT_PREVIEW_SECRET: "preview-secret",
  STOREFRONT_INTERNAL_BASE_URL: "http://storefront:4321",
  DASHBOARD_PUBLIC_BASE_URL: "https://app.example.com",
  BETTER_AUTH_URL: "https://api.example.com",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_COOKIE_DOMAIN: ".example.com",
  BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example.com,https://*.example.com",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
  MEDIA_STORAGE_PROVIDER: "s3",
  MEDIA_S3_ENDPOINT: "https://media.example.com",
  MEDIA_S3_INTERNAL_ENDPOINT: "http://seaweedfs:8333",
  MEDIA_S3_BUCKET: "ecs-media",
  MEDIA_S3_ACCESS_KEY_ID: "ecs",
  MEDIA_S3_SECRET_ACCESS_KEY: "media-secret",
  MEDIA_S3_PUBLIC_BASE_URL: "https://media.example.com/ecs-media",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM_ACCOUNTS: "accounts@example.com",
  EMAIL_FROM_ORDERS: "orders@example.com",
  EMAIL_FROM_BILLING: "billing@example.com",
  EMAIL_FROM_NOTIFICATIONS: "notifications@example.com",
  GOOGLE_AUTH_ENABLED: "auto",
};

describe("Platform production environment", () => {
  it("accepts a complete production environment", () => {
    assert.doesNotThrow(() => assertPlatformProductionEnvironment(validEnvironment));
  });

  it("reports every missing or inconsistent production setting together", () => {
    assert.throws(
      () =>
        assertPlatformProductionEnvironment({
          NODE_ENV: "production",
          GOOGLE_AUTH_ENABLED: "true",
          GOOGLE_CLIENT_ID: "client-only",
        }),
      (error: Error) =>
        error.message.includes("PLATFORM_DATABASE_URL is required") &&
        error.message.includes("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET") &&
        error.message.includes("Google authentication is enabled"),
    );
  });

  it("keeps the executable contract aligned with Dokploy Compose", () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const compose = readFileSync(resolve(repoRoot, "infra/dokploy/docker-compose.yml"), "utf8");
    const block = compose.match(/x-platform-environment:[\s\S]*?\nx-medusa-environment:/)?.[0];
    assert.ok(block, "x-platform-environment block must exist");
    const composeKeys = [...block.matchAll(/^  ([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]);
    assert.deepEqual(composeKeys.sort(), Object.keys(PLATFORM_PRODUCTION_ENVIRONMENT).sort());
  });

  it("documents every operator-owned variable in the deployment example", () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const example = readFileSync(resolve(repoRoot, "infra/dokploy/.env.example"), "utf8");
    const documented = new Set(
      [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
    );
    const missing = Object.entries(PLATFORM_PRODUCTION_ENVIRONMENT)
      .filter(([, owner]) => owner === "operator")
      .map(([key]) => key)
      .filter((key) => !documented.has(key));
    assert.deepEqual(missing, []);
  });
});
