import assert from "node:assert/strict";
import test from "node:test";

import { isOpsHost, normalizeHost } from "./ops-host";

test("operator host isolation accepts only the exact configured host", () => {
  const previous = process.env.SUPERADMIN_PUBLIC_BASE_URL;
  process.env.SUPERADMIN_PUBLIC_BASE_URL = "https://ops.ecs.example";
  try {
    assert.equal(isOpsHost("ops.ecs.example"), true);
    assert.equal(isOpsHost("OPS.ECS.EXAMPLE:443"), true);
    assert.equal(isOpsHost("shop.ops.ecs.example"), false);
    assert.equal(isOpsHost("ops.ecs.example.attacker.test"), false);
  } finally {
    if (previous === undefined) delete process.env.SUPERADMIN_PUBLIC_BASE_URL;
    else process.env.SUPERADMIN_PUBLIC_BASE_URL = previous;
  }
});

test("operator host normalization removes ports without accepting suffixes", () => {
  assert.equal(normalizeHost("ops.lvh.me:3002"), "ops.lvh.me");
  assert.equal(normalizeHost(null), "");
});

test("operator host isolation permits loopback only during local development", () => {
  assert.equal(isOpsHost("localhost:3002", "development"), true);
  assert.equal(isOpsHost("127.0.0.1:3002", "development"), true);
  assert.equal(isOpsHost("[::1]:3002", "development"), true);
  assert.equal(isOpsHost("localhost:3002", "production"), false);
  assert.equal(isOpsHost("127.0.0.1:3002", "production"), false);
});
