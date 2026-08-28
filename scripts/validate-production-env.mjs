import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUIRED_SECRETS = [
  "POSTGRES_PASSWORD",
  "PLATFORM_INTERNAL_API_TOKEN",
  "BETTER_AUTH_SECRET",
  "STOREFRONT_CACHE_PURGE_SECRET",
  "STOREFRONT_PREVIEW_SECRET",
  "MEDUSA_JWT_SECRET",
  "MEDUSA_COOKIE_SECRET",
  "MEDIA_S3_SECRET_ACCESS_KEY",
];

const OPTIONAL_SECRETS = [
  "PLATFORM_SECRETS_ENCRYPTION_KEY",
  "PAYMENTS_CREDENTIALS_ENCRYPTION_KEY",
  "TELEGRAM_WEBHOOK_SECRET",
];

const placeholderPattern = /(?:replace[-_ ]with|your[-_ ]org|your[-_ ]repo|example\.com)/i;

export function parseEnvironment(source) {
  const environment = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    environment[key] = value;
  }
  return environment;
}

function expect(errors, condition, message) {
  if (!condition) errors.push(message);
}

function validHostname(value) {
  return (
    value.length <= 253 &&
    value.split(".").length >= 2 &&
    value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

function validateSecret(errors, key, value, required) {
  if (!value) {
    if (required) errors.push(`${key} is required`);
    return;
  }
  expect(errors, value.length >= 32, `${key} must contain at least 32 characters`);
  expect(errors, !placeholderPattern.test(value), `${key} still contains a placeholder value`);
}

function parseUrl(errors, key, value, protocols) {
  try {
    const url = new URL(value);
    expect(errors, protocols.includes(url.protocol), `${key} must use ${protocols.join(" or ")}`);
    return url;
  } catch {
    errors.push(`${key} must be a valid URL`);
    return null;
  }
}

export function validateProductionEnvironment(environment) {
  const errors = [];
  const warnings = [];
  const baseDomain = environment.BASE_DOMAIN ?? "";

  expect(errors, validHostname(baseDomain), "BASE_DOMAIN must be a valid delegated hostname");
  expect(errors, !placeholderPattern.test(baseDomain), "BASE_DOMAIN still contains a placeholder");
  expect(
    errors,
    /^ghcr\.io\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(environment.IMAGE_PREFIX ?? ""),
    "IMAGE_PREFIX must identify a GHCR repository namespace",
  );
  expect(errors, Boolean(environment.IMAGE_TAG), "IMAGE_TAG is required");
  if (environment.IMAGE_TAG === "main") {
    warnings.push("IMAGE_TAG=main is mutable; pin sha-<git-sha> for rollback-safe releases");
  }

  for (const key of REQUIRED_SECRETS) validateSecret(errors, key, environment[key], true);
  for (const key of OPTIONAL_SECRETS) validateSecret(errors, key, environment[key], false);

  const populatedSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS]
    .map((key) => [key, environment[key]])
    .filter(([, value]) => Boolean(value));
  const secretOwners = new Map();
  for (const [key, value] of populatedSecrets) {
    const other = secretOwners.get(value);
    if (other) errors.push(`${key} must not reuse ${other}`);
    else secretOwners.set(value, key);
  }

  const postgresPassword = environment.POSTGRES_PASSWORD ?? "";
  const platformDatabase = parseUrl(
    errors,
    "PLATFORM_DATABASE_URL",
    environment.PLATFORM_DATABASE_URL ?? "",
    ["postgres:", "postgresql:"],
  );
  const medusaDatabase = parseUrl(
    errors,
    "MEDUSA_DATABASE_URL",
    environment.MEDUSA_DATABASE_URL ?? "",
    ["postgres:", "postgresql:"],
  );
  for (const [key, url] of [
    ["PLATFORM_DATABASE_URL", platformDatabase],
    ["MEDUSA_DATABASE_URL", medusaDatabase],
  ]) {
    if (!url) continue;
    expect(errors, url.hostname === "postgres", `${key} must target the private postgres service`);
    expect(
      errors,
      decodeURIComponent(url.password) === postgresPassword,
      `${key} password must match POSTGRES_PASSWORD`,
    );
  }
  if (platformDatabase && medusaDatabase) {
    expect(
      errors,
      platformDatabase.pathname !== medusaDatabase.pathname,
      "Platform and Medusa must use separate databases",
    );
  }

  if (validHostname(baseDomain)) {
    const operationsUrl = parseUrl(
      errors,
      "SUPERADMIN_PUBLIC_BASE_URL",
      environment.SUPERADMIN_PUBLIC_BASE_URL ?? "",
      ["https:"],
    );
    expect(
      errors,
      operationsUrl?.href === `https://ops.${baseDomain}/`,
      `SUPERADMIN_PUBLIC_BASE_URL must be https://ops.${baseDomain}`,
    );
    const demoHost = environment.STOREFRONT_DEMO_HOST ?? "";
    expect(errors, validHostname(demoHost), "STOREFRONT_DEMO_HOST must be a valid hostname");
    expect(
      errors,
      demoHost === `demo.${baseDomain}`,
      `STOREFRONT_DEMO_HOST must be demo.${baseDomain}`,
    );
    const expected = {
      MEDIA_S3_ENDPOINT: `https://media.${baseDomain}`,
      MEDIA_S3_CORS_ALLOW_ORIGIN: `https://dashboard.${baseDomain}`,
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(errors, environment[key] === value, `${key} must be ${value}`);
    }
    const publicMedia = parseUrl(
      errors,
      "MEDIA_S3_PUBLIC_BASE_URL",
      environment.MEDIA_S3_PUBLIC_BASE_URL ?? "",
      ["https:"],
    );
    expect(
      errors,
      publicMedia?.hostname === `media.${baseDomain}`,
      `MEDIA_S3_PUBLIC_BASE_URL must use media.${baseDomain}`,
    );
  }

  const hasEmailKey = Boolean(environment.RESEND_API_KEY);
  const hasEmailSender = Boolean(environment.EMAIL_FROM);
  expect(
    errors,
    hasEmailKey === hasEmailSender,
    "RESEND_API_KEY and EMAIL_FROM must be configured together",
  );
  const hasTelegramToken = Boolean(environment.TELEGRAM_BOT_TOKEN);
  const hasTelegramUsername = Boolean(environment.TELEGRAM_BOT_USERNAME);
  expect(
    errors,
    hasTelegramToken === hasTelegramUsername,
    "TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME must be configured together",
  );

  return { errors, warnings };
}

async function main() {
  const path = process.argv[2] ?? "infra/dokploy/.env";
  const environment = parseEnvironment(await readFile(path, "utf8"));
  const result = validateProductionEnvironment(environment);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`error: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Production environment is valid (${path}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
