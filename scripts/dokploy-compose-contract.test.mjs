import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const compose = await readFile(
  new URL("../infra/dokploy/docker-compose.yml", import.meta.url),
  "utf8",
);
const dockerfile = await readFile(new URL("../infra/docker/Dockerfile", import.meta.url), "utf8");
const landingPackage = JSON.parse(
  await readFile(new URL("../apps/landing/package.json", import.meta.url), "utf8"),
);

function serviceBlock(service, nextService) {
  const start = compose.indexOf(`\n  ${service}:`);
  const end = compose.indexOf(`\n  ${nextService}:`, start + 1);
  assert.notEqual(start, -1, `${service} service must exist`);
  assert.notEqual(end, -1, `${nextService} service must follow ${service}`);
  return compose.slice(start, end);
}

test("dashboard and Operations console receive the same public Operations URL", () => {
  const operationsUrl =
    /SUPERADMIN_PUBLIC_BASE_URL: \$\{SUPERADMIN_PUBLIC_BASE_URL:-https:\/\/ops\.\$\{BASE_DOMAIN\}\}/;
  assert.match(serviceBlock("dashboard", "superadmin"), operationsUrl);
  assert.match(serviceBlock("superadmin", "landing"), operationsUrl);
});

test("landing receives runtime public origins and is health checked", () => {
  const landing = serviceBlock("landing", "storefront");
  assert.match(landing, /PLATFORM_API_BASE_URL: http:\/\/platform-api:3000/);
  assert.match(landing, /PUBLIC_PLATFORM_API_URL: https:\/\/api\.\$\{BASE_DOMAIN\}/);
  assert.match(landing, /PUBLIC_DASHBOARD_URL: https:\/\/app\.\$\{BASE_DOMAIN\}/);
  assert.match(landing, /PUBLIC_SITE_URL: https:\/\/\$\{BASE_DOMAIN\}/);
  assert.match(landing, /4322\/healthz/);
});

test("landing packages Sharp for Astro's runtime image endpoint", () => {
  assert.match(landingPackage.dependencies.sharp, /^\^0\.35\./);
  assert.match(dockerfile, /test -d \/out\/landing\/node_modules\/sharp/);
});

test("storefront receives the branded demo host at runtime", () => {
  assert.match(
    serviceBlock("storefront", "caddy"),
    /STOREFRONT_DEMO_HOST: \$\{STOREFRONT_DEMO_HOST:-demo\.\$\{BASE_DOMAIN\}\}/,
  );
});

test("Traefik requests one DNS-01 certificate for the base domain and wildcard", () => {
  const caddyStart = compose.indexOf("\n  caddy:");
  const caddy = compose.slice(caddyStart, compose.indexOf("\nvolumes:", caddyStart));
  assert.match(caddy, /Host\(`\$\{BASE_DOMAIN\}`\) \|\| HostRegexp/);
  assert.match(
    caddy,
    /traefik\.http\.routers\.ecs-caddy-https\.tls\.certresolver=\$\{TLS_CERT_RESOLVER:-letsencrypt-dns\}/,
  );
  assert.match(
    caddy,
    /traefik\.http\.routers\.ecs-caddy-https\.tls\.domains\[0\]\.main=\$\{BASE_DOMAIN\}/,
  );
  assert.match(
    caddy,
    /traefik\.http\.routers\.ecs-caddy-https\.tls\.domains\[0\]\.sans=\*\.\$\{BASE_DOMAIN\}/,
  );
  assert.doesNotMatch(caddy, /ecs-caddy-demo-certs/);
});

test("storefront receives the trusted public media base at runtime", () => {
  assert.match(
    serviceBlock("storefront", "caddy"),
    /MEDIA_S3_PUBLIC_BASE_URL: \$\{MEDIA_S3_PUBLIC_BASE_URL:-https:\/\/media\.\$\{BASE_DOMAIN\}\/\$\{MEDIA_S3_BUCKET:-ecs-media\}\}/,
  );
});

test("platform-api environment wires platform billing destinations and links.et", () => {
  assert.match(
    compose,
    /PLATFORM_BILLING_TELEBIRR_ACCOUNT: \$\{PLATFORM_BILLING_TELEBIRR_ACCOUNT:-\}/,
  );
  assert.match(compose, /PLATFORM_BILLING_CBE_ACCOUNT: \$\{PLATFORM_BILLING_CBE_ACCOUNT:-\}/);
  assert.match(compose, /LINKS_ET_API_KEY: \$\{LINKS_ET_API_KEY:-\}/);
});

test("production deployment wires optional Google OAuth configuration", () => {
  assert.match(compose, /GOOGLE_AUTH_ENABLED: \$\{GOOGLE_AUTH_ENABLED:-auto\}/);
  assert.match(compose, /GOOGLE_CLIENT_ID: \$\{GOOGLE_CLIENT_ID:-\}/);
  assert.match(compose, /GOOGLE_CLIENT_SECRET: \$\{GOOGLE_CLIENT_SECRET:-\}/);
});
