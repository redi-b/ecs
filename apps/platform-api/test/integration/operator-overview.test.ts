import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("operator reads and diagnostics", () => {
  it("returns operator identity and exact active permissions from one session endpoint", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getPlatformPrincipalAccess: async (userId) => ({
          principal: { id: "principal_1", userId },
          permissions: ["platform.overview.read", "tenants.read"],
        }),
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "ECS Operator" },
        }),
      },
    );

    const response = await app.request("/platform/operator/session");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      operator: { id: "operator_1", email: "operator@ecs.local", name: "ECS Operator" },
      principalId: "principal_1",
      permissions: ["platform.overview.read", "tenants.read"],
    });
  });

  it("returns the operations overview through exact read authority", async () => {
    let permissionSeen: string | undefined;
    const overview = {
      summary: { merchants: 12, activeMerchants: 9, attentionItems: 2, activeSupportAccess: 1 },
      attention: [],
      recentActivity: [],
      generatedAt: "2026-08-26T12:00:00.000Z",
    };
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminOverview: async () => overview,
      },
    );

    const response = await app.request("/platform/operator/overview");

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "platform.overview.read");
    assert.deepEqual(await response.json(), overview);
  });

  it("keeps work, audit, and operator directory reads behind separate permissions", async () => {
    const permissions: string[] = [];
    let auditInput: unknown;
    let workInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        listSuperadminWork: async (input) => {
          workInput = input;
          return {
            kind: input.kind ?? "shop_setup",
            items: [],
            count: 0,
            limit: input.limit,
            offset: input.offset,
          };
        },
        listSuperadminAudit: async (input) => {
          auditInput = input;
          return { events: [], count: 0, limit: input.limit, offset: input.offset };
        },
        listPlatformOperators: async () => ({ operators: [] }),
        getPlatformHealth: async () => ({
          status: "clear",
          dependencies: [],
          backgroundWork: {
            queued: 0,
            active: 0,
            failedLast24Hours: 0,
            oldestQueuedAt: null,
            types: [],
          },
          notifications: { pending: 0, retrying: 0, failedLast24Hours: 0, channels: [] },
          media: { pending: 0, processing: 0, ready: 0, failed: 0 },
          merchants: { active: 0, draft: 0, suspended: 0, cancelled: 0 },
          generatedAt: "2026-08-27T00:00:00.000Z",
        }),
      },
    );

    assert.equal(
      (await app.request("/platform/operator/work?kind=background_job&limit=15&offset=30")).status,
      200,
    );
    assert.equal(
      (
        await app.request(
          "/platform/operator/audit?category=support&limit=25&offset=50&actor=Liya&merchant=bole&action=support&resource=grant&outcome=failed&from=2026-08-01&to=2026-08-27",
        )
      ).status,
      200,
    );
    assert.equal((await app.request("/platform/operator/operators")).status, 200);
    assert.equal((await app.request("/platform/operator/health")).status, 200);
    assert.deepEqual(permissions, [
      "platform.work.read",
      "platform.audit.read",
      "platform.operators.read",
      "platform.health.read",
    ]);
    assert.deepEqual(workInput, { kind: "background_job", limit: 15, offset: 30 });
    assert.deepEqual(auditInput, {
      action: "support",
      actor: "Liya",
      category: "support",
      from: new Date("2026-07-31T21:00:00.000Z"),
      limit: 25,
      merchant: "bole",
      offset: 50,
      outcome: "failed",
      resource: "grant",
      to: new Date("2026-08-27T21:00:00.000Z"),
    });
  });

  it("projects merchant commerce review sections through their separate read permissions", async () => {
    const permissions: string[] = [];
    let reviewInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return permission === "billing.invoices.read"
            ? { ok: true, permission, principal: { id: "principal_1", userId } }
            : { ok: false };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminCommerceReview: async (input) => {
          reviewInput = input;
          return { billing: null, paymentOnboarding: null };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/commerce-review");

    assert.equal(response.status, 200);
    assert.deepEqual(permissions, ["billing.invoices.read", "payments.onboarding.read"]);
    assert.deepEqual(reviewInput, {
      includeBilling: true,
      includePayments: false,
      tenantId: "tenant_1",
    });
  });

  it("recovers failed setup only through recent retry authority with a recorded reason", async () => {
    let permissionSeen: string | undefined;
    let recoveryInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        recoverSuperadminWork: async (input) => {
          recoveryInput = input;
          return {
            ok: true,
            tenant: {
              id: "tenant_1",
              name: "Recovered Shop",
              handle: "recovered-shop",
              status: "draft",
              createdAt: "2026-08-27T00:00:00.000Z",
              updatedAt: "2026-08-27T00:00:00.000Z",
            },
          } as never;
        },
      },
    );

    const response = await app.request("/platform/operator/work/attempt_1/recover", {
      body: JSON.stringify({ reason: "Provider credentials were corrected" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "platform.work.retry");
    assert.deepEqual(recoveryInput, {
      attemptId: "attempt_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Provider credentials were corrected",
    });
  });

  it("keeps job diagnostics read-only and job controls behind recent retry authority", async () => {
    const permissions: string[] = [];
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getJobOperations: async () => ({ queues: [], runs: [], scheduler: null }),
        retryFailedJob: async (id) => ({
          ok: false,
          error: id === "missing" ? "job_not_found" : "job_not_retryable",
        }),
        cancelQueuedJob: async () => ({ ok: false, error: "job_state_changed" }),
      },
    );

    assert.equal((await app.request("/platform/operator/jobs")).status, 200);
    assert.equal(
      (await app.request("/platform/operator/jobs/missing/retry", { method: "POST" })).status,
      404,
    );
    assert.equal(
      (await app.request("/platform/operator/jobs/run_1/cancel", { method: "POST" })).status,
      409,
    );
    assert.deepEqual(permissions, [
      "platform.health.read",
      "platform.work.retry",
      "platform.work.retry",
    ]);
  });

  it("returns entitlement diagnostics through read-only platform authority", async () => {
    let tenantId: string | undefined;
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return {
            ok: true,
            permission,
            principal: { id: "principal_1", userId },
          };
        },
        getEntitlementSummary: async (input) => {
          tenantId = input.tenantId;
          return {
            entitlement: {
              allowed: true,
              key: "customDomains",
              source: "override",
              subscriptionStatus: "active",
            },
            overrides: [],
          };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/entitlements");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "billing.entitlements.read");
    assert.equal(tenantId, "tenant_1");
    assert.equal((await response.json()).entitlement.source, "override");
  });

  it("lists support access through read-only platform authority", async () => {
    let permissionSeen: string | undefined;
    let tenantId: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date(0) },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        listSupportAccessGrants: async (input) => {
          tenantId = input.tenantId;
          return { grants: [] };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support-access");

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.support.access.read");
    assert.equal(tenantId, "tenant_1");
    assert.deepEqual(await response.json(), { grants: [] });
  });

  it("returns only the safe operational summary with tenants.operations.read", async () => {
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return {
            ok: true,
            permission,
            principal: { id: "principal_1", userId },
          };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminOperationalSummary: async () => ({
          ok: true,
          summary: {
            readiness: {
              ready: true,
              missing: [],
              tenantReady: true,
              domainReady: true,
              commerceReady: true,
              storefrontReady: true,
              provisioningReady: true,
            },
            storefront: { hasDraft: true, isPublished: true },
            domains: { total: 1, custom: 0, pending: 0, primaryHostname: "abebe.lvh.me" },
            billing: {
              available: true,
              planName: "Starter",
              subscriptionStatus: "active",
              pendingInvoiceCount: 0,
            },
            payments: { total: 1, pendingReview: 0, approved: 1 },
          },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/operations");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.operations.read");
    assert.equal((await response.json()).billing.planName, "Starter");
  });

  it("returns projected diagnostics with tenants.diagnostics.read", async () => {
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminDiagnostics: async () => ({
          jobs: { recentFailures: [] },
          notifications: { recentFailures: [] },
          media: { total: 3, pending: 1, ready: 2, failed: 0, recentFailures: [] },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/diagnostics");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.diagnostics.read");
    assert.equal((await response.json()).media.ready, 2);
  });
});
