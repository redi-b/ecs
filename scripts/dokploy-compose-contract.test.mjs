import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const compose = await readFile(
  new URL("../infra/dokploy/docker-compose.yml", import.meta.url),
  "utf8",
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
  assert.match(serviceBlock("superadmin", "storefront"), operationsUrl);
});

test("storefront receives the branded demo host at runtime", () => {
  assert.match(
    serviceBlock("storefront", "caddy"),
    /STOREFRONT_DEMO_HOST: \$\{STOREFRONT_DEMO_HOST:-demo\.\$\{BASE_DOMAIN\}\}/,
  );
});

test("storefront receives the trusted public media base at runtime", () => {
  assert.match(
    serviceBlock("storefront", "caddy"),
    /MEDIA_S3_PUBLIC_BASE_URL: \$\{MEDIA_S3_PUBLIC_BASE_URL:-https:\/\/media\.\$\{BASE_DOMAIN\}\/\$\{MEDIA_S3_BUCKET:-ecs-media\}\}/,
  );
});
