import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { resolveMedusaAdminToken } from "./admin-token.js";

describe("resolveMedusaAdminToken", () => {
  let previousEnvToken: string | undefined;

  before(() => {
    previousEnvToken = process.env.MEDUSA_ADMIN_API_TOKEN;
    // Avoid leakage from host env / prior tests.
    delete process.env.MEDUSA_ADMIN_API_TOKEN;
  });

  after(() => {
    if (previousEnvToken === undefined) {
      delete process.env.MEDUSA_ADMIN_API_TOKEN;
    } else {
      process.env.MEDUSA_ADMIN_API_TOKEN = previousEnvToken;
    }
  });

  it("prefers a valid env token and does not bootstrap", async () => {
    let bootstrapCalls = 0;
    let probeCalls = 0;
    const result = await resolveMedusaAdminToken({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => undefined,
          }),
        }),
        execute: async () => ({ rows: [] }),
      } as never,
      medusaInternalUrl: "http://medusa:9000",
      internalApiToken: "internal",
      envToken: "sk_env_token",
      persistEnvTokenToDb: false,
      fetchImpl: async (url) => {
        if (String(url).includes("/internal/platform/bootstrap-admin")) {
          bootstrapCalls += 1;
          return Response.json({ error: "should_not_call" }, { status: 500 });
        }
        probeCalls += 1;
        return Response.json({ regions: [] }, { status: 200 });
      },
    });

    assert.deepEqual(result, { ok: true, token: "sk_env_token", source: "env" });
    assert.equal(bootstrapCalls, 0);
    assert.equal(probeCalls, 1);
  });

  it("re-bootstraps when env token is rejected by Medusa", async () => {
    process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-for-system-secrets";
    const stored: { value?: string } = {};

    const result = await resolveMedusaAdminToken({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () =>
                stored.value ? [{ valueEncrypted: stored.value }] : [],
            }),
          }),
        }),
        insert: () => ({
          values: (input: { key: string; valueEncrypted: string }) => ({
            onConflictDoUpdate: async ({ set }: { set: { valueEncrypted: string } }) => {
              stored.value = set.valueEncrypted ?? input.valueEncrypted;
            },
          }),
        }),
        execute: async () => ({ rows: [] }),
      } as never,
      medusaInternalUrl: "http://medusa:9000",
      internalApiToken: "internal-token",
      envToken: "sk_stale_env",
      fetchImpl: async (url, init) => {
        if (String(url).includes("/internal/platform/bootstrap-admin")) {
          assert.equal(init?.method, "POST");
          const body = JSON.parse(String(init?.body ?? "{}")) as { forceNewKey?: boolean };
          assert.equal(body.forceNewKey, true);
          return Response.json(
            { ok: true, medusaAdminApiToken: "sk_bootstrapped" },
            { status: 201 },
          );
        }
        // Probe: reject the stale env token
        return Response.json({ message: "Unauthorized" }, { status: 401 });
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.token, "sk_bootstrapped");
      assert.equal(result.source, "bootstrap");
    }
  });

  it("bootstraps via internal Medusa route when env and db are empty", async () => {
    const stored: { key?: string; value?: string } = {};
    process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-for-system-secrets";

    const result = await resolveMedusaAdminToken({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () =>
                stored.value
                  ? [{ valueEncrypted: stored.value }]
                  : [],
            }),
          }),
        }),
        insert: () => ({
          values: (input: { key: string; valueEncrypted: string }) => ({
            onConflictDoUpdate: async ({ set }: { set: { valueEncrypted: string } }) => {
              stored.key = input.key;
              stored.value = set.valueEncrypted ?? input.valueEncrypted;
            },
          }),
        }),
        execute: async () => ({ rows: [] }),
      } as never,
      medusaInternalUrl: "http://medusa:9000/",
      internalApiToken: "internal-token",
      envToken: "",
      fetchImpl: async (url, init) => {
        if (String(url).includes("/internal/platform/bootstrap-admin")) {
          assert.equal(init?.method, "POST");
          assert.equal(
            new Headers(init?.headers).get("x-platform-internal-token"),
            "internal-token",
          );
          return Response.json(
            { ok: true, medusaAdminApiToken: "sk_bootstrapped" },
            { status: 201 },
          );
        }
        // probe
        return Response.json({ regions: [] }, { status: 200 });
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.token, "sk_bootstrapped");
      assert.equal(result.source, "bootstrap");
    }
  });

  it("fails closed when internal token is missing and no env/db token", async () => {
    const result = await resolveMedusaAdminToken({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => undefined,
          }),
        }),
        execute: async () => ({ rows: [] }),
      } as never,
      medusaInternalUrl: "http://medusa:9000",
      internalApiToken: undefined,
      envToken: "",
      fetchImpl: async () => Response.json({}),
    });

    assert.deepEqual(result, { ok: false, error: "platform_internal_token_missing" });
  });
});
