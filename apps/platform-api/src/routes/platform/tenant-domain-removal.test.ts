import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerPlatformTenantDomainRoutes } from "./tenant-domains.js";

const tenantId = "454c89a5-f217-4f11-8692-af60dd680ac1";
const domainId = "73db9e89-783e-47b7-9391-3ef7d9ab7ab0";
const url = `/platform/tenants/${tenantId}/domains/${domainId}`;
const session = { user: { id: "merchant", email: "merchant@example.com", name: "Merchant" } };

test("domain removal authenticates, authorizes domains.manage, and scopes the actor and tenant", async () => {
  let authorization: unknown;
  let removal: unknown;
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  registerPlatformTenantDomainRoutes(app, {
    getSession: async () => session,
    authorizeDashboardForTenant: async (input) => {
      authorization = input;
      return { ok: true, actor: { ...session.user, role: "owner" } };
    },
    removeTenantDomain: async (input) => {
      removal = input;
      return { ok: true, status: "removed" };
    },
  } satisfies Partial<PlatformAppOptions>);
  const response = await app.request(url, { method: "DELETE" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "removed" });
  assert.deepEqual(authorization, {
    tenantId,
    userId: "merchant",
    permission: { domains: ["manage"] },
  });
  assert.deepEqual(removal, { tenantId, domainId, userId: "merchant" });
});

test("domain removal rejects unauthorized or invalid requests before mutation", async () => {
  for (const scenario of [
    { authenticated: false, allowed: true, path: url, status: 401 },
    { authenticated: true, allowed: false, path: url, status: 403 },
    {
      authenticated: true,
      allowed: true,
      path: `/platform/tenants/${tenantId}/domains/not-a-uuid`,
      status: 400,
    },
  ]) {
    let mutations = 0;
    const app = new Hono<{ Variables: PlatformAppVariables }>();
    registerPlatformTenantDomainRoutes(app, {
      getSession: async () => (scenario.authenticated ? session : null),
      authorizeDashboardForTenant: async () =>
        scenario.allowed
          ? { ok: true, actor: { ...session.user, role: "owner" } }
          : { ok: false, error: "dashboard_forbidden" },
      removeTenantDomain: async () => {
        mutations++;
        return { ok: true, status: "removed" };
      },
    });
    assert.equal((await app.request(scenario.path, { method: "DELETE" })).status, scenario.status);
    assert.equal(mutations, 0);
  }
});

test("domain removal distinguishes accepted repair from completed withdrawal and lock contention", async () => {
  for (const result of [
    { ok: true as const, status: "removing" as const },
    { ok: false as const, status: 503 as const, error: "domain_reconciliation_busy" as const },
    { ok: false as const, status: 404 as const, error: "domain_not_found" as const },
  ]) {
    const app = new Hono<{ Variables: PlatformAppVariables }>();
    registerPlatformTenantDomainRoutes(app, {
      getSession: async () => session,
      authorizeDashboardForTenant: async () => ({
        ok: true,
        actor: { ...session.user, role: "owner" },
      }),
      removeTenantDomain: async () => result,
    });
    const response = await app.request(url, { method: "DELETE" });
    assert.equal(response.status, result.ok ? 202 : result.status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(
      response.headers.get("retry-after"),
      !result.ok && result.status === 503 ? "5" : null,
    );
    assert.deepEqual(
      await response.json(),
      result.ok ? { status: "removing" } : { error: result.error },
    );
  }
});
