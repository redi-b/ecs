import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMedusaAdminToken } from "./admin-token.js";

function createMemoryDb(initial?: { key: string; valueEncrypted: string }) {
  const rows = new Map<string, { valueEncrypted: string; fingerprint: string | null }>();
  if (initial) {
    rows.set(initial.key, { valueEncrypted: initial.valueEncrypted, fingerprint: "xxxx" });
  }

  return {
    // Minimal surface used by system-secrets-service + advisory lock
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const key = [...rows.keys()][0];
            // actual service filters by key — use a stub that returns via execute path
            return [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => undefined,
      }),
    }),
    execute: async () => ({ rows: [] }),
    // override below with proper mock
    _rows: rows,
  };
}

describe("resolveMedusaAdminToken", () => {
  it("prefers env token without calling Medusa bootstrap", async () => {
    let bootstrapCalls = 0;
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
      fetchImpl: async () => {
        bootstrapCalls += 1;
        return Response.json({ error: "should_not_call" }, { status: 500 });
      },
    });

    assert.deepEqual(result, { ok: true, token: "sk_env_token", source: "env" });
    assert.equal(bootstrapCalls, 0);
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
