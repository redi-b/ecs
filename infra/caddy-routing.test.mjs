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
