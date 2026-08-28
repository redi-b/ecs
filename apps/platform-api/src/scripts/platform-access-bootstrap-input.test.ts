import assert from "node:assert/strict";
import test from "node:test";
import { parsePlatformAccessBootstrapInput } from "./platform-access-bootstrap-input.js";

test("parses an explicitly confirmed allowlisted bootstrap grant", () => {
  const result = parsePlatformAccessBootstrapInput([
    "--user-id",
    "user_1",
    "--confirmed-by-user-id",
    "owner_1",
    "--permissions",
    "tenants.read,tenants.status.update",
    "--confirm-bootstrap",
  ]);
  assert.deepEqual(result.permissions, ["tenants.read", "tenants.status.update"]);
  assert.equal(result.userId, "user_1");
});

test("rejects unknown permissions and unconfirmed bootstrap attempts", () => {
  assert.throws(
    () =>
      parsePlatformAccessBootstrapInput([
        "--user-id",
        "user_1",
        "--confirmed-by-user-id",
        "owner_1",
        "--permissions",
        "secrets.read",
        "--confirm-bootstrap",
      ]),
    /Permissions must be selected/,
  );
  assert.throws(
    () =>
      parsePlatformAccessBootstrapInput([
        "--user-id",
        "user_1",
        "--confirmed-by-user-id",
        "owner_1",
        "--permissions",
        "tenants.read",
      ]),
    /Required/,
  );
});

test("requires a different active user to confirm bootstrap authority", () => {
  assert.throws(
    () =>
      parsePlatformAccessBootstrapInput([
        "--user-id",
        "user_1",
        "--confirmed-by-user-id",
        "user_1",
        "--permissions",
        "tenants.read",
        "--confirm-bootstrap",
      ]),
    /must be different people/,
  );
});
