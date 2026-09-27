import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const configs = ["infra/caddy/Caddyfile", "infra/dokploy/Caddyfile"];
const merchantPaths = [
  "/dashboard*",
  "/onboarding*",
  "/sign-in*",
  "/sign-up*",
  "/sign-out*",
  "/session*",
  "/check-email*",
  "/verify-email*",
  "/forgot-password*",
  "/reset-password*",
  "/accept-invitation*",
];

for (const path of configs) {
  test(`${path} sends merchant paths to the dashboard`, async () => {
    const source = await readFile(path, "utf8");
    const matcher = source
      .split("\n")
      .find((line) => line.includes("@merchant") && line.includes(" path "));

    assert.ok(matcher, "merchant dashboard matcher is missing");
    for (const merchantPath of merchantPaths) {
      assert.ok(matcher.includes(merchantPath), `${merchantPath} is not routed to the dashboard`);
    }
    assert.match(source, /\/favicon\.svg/);
  });
}

test("local Caddy routes the landing hostname before tenant storefronts", async () => {
  const source = await readFile("infra/caddy/Caddyfile", "utf8");
  const landing = source.indexOf("http://ecs.lvh.me");
  const storefronts = source.indexOf("http://*.lvh.me");
  assert.ok(landing >= 0, "landing route is missing");
  assert.ok(landing < storefronts, "landing route must precede the wildcard storefront route");
  assert.match(source.slice(landing, storefronts), /host\.docker\.internal:4322/);
});

test("production Caddy routes the base domain to the landing service", async () => {
  const source = await readFile("infra/dokploy/Caddyfile", "utf8");
  assert.match(source, /@landing host \{\$BASE_DOMAIN\}/);
  assert.match(source, /reverse_proxy ecs-landing:4322/);
});
