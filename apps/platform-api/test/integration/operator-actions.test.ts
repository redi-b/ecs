import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("operator mutations and authorization", () => {
  it("lets a recently authenticated platform principal create an entitlement override", async () => {
    let overrideInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createEntitlementOverride: async (input) => {
          overrideInput = input;
          return { ok: true, override: { id: "override_1" } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/entitlements/customDomains/overrides",
      {
        body: JSON.stringify({
          expiresAt: "2099-08-25T12:00:00.000Z",
          reason: " Temporary launch support ",
          value: true,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
    assert.deepEqual(overrideInput, {
      expiresAt: new Date("2099-08-25T12:00:00.000Z"),
      key: "customDomains",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Temporary launch support",
      tenantId: "tenant_1",
      value: true,
    });
  });

  it("lets an operator update a tenant billing invoice status", async () => {
    let updateInput:
      | {
          invoiceId: string;
          operatorUserId: string;
          provider?: string | null | undefined;
          providerReference?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        updateBillingInvoiceStatus: async (input) => {
          updateInput = input;

          return {
            ok: true,
            invoice: {
              id: input.invoiceId,
              amount: "999.00",
              currency: "ETB",
              status: input.status,
              dueAt: "2026-06-05T00:00:00.000Z",
              paidAt: "2026-06-02T00:00:00.000Z",
              provider: input.provider ?? null,
              providerReference: input.providerReference ?? null,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/billing/invoices/invoice_1/status",
      {
        body: JSON.stringify({
          status: " paid ",
          provider: " manual ",
          providerReference: " receipt_1 ",
          reason: "Bank receipt matched the invoice total.",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(updateInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      invoiceId: "invoice_1",
      status: "paid",
      provider: "manual",
      providerReference: "receipt_1",
      reason: "Bank receipt matched the invoice total.",
    });
    assert.deepEqual(await response.json(), {
      invoice: {
        id: "invoice_1",
        amount: "999.00",
        currency: "ETB",
        status: "paid",
        dueAt: "2026-06-05T00:00:00.000Z",
        paidAt: "2026-06-02T00:00:00.000Z",
        provider: "manual",
        providerReference: "receipt_1",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });
  });

  it("lets an operator suspend a tenant", async () => {
    let updateInput:
      | {
          operatorUserId: string;
          reason?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        updateTenantStatus: async (input) => {
          updateInput = input;

          return {
            ok: true,
            tenant: {
              id: input.tenantId,
              name: "Abebe Market",
              handle: "abebe",
              status: input.status,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({
        status: " suspended ",
        reason: " Past due billing. ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(updateInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      status: "suspended",
      reason: "Past due billing.",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "suspended",
      },
    });
  });

  it("returns operator support history for a tenant", async () => {
    let historyInput: { limit: number; tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        getOperatorSupportHistory: async (input) => {
          historyInput = input;

          return {
            ok: true,
            history: {
              notes: [
                {
                  id: "note_1",
                  operatorUserId: "operator_1",
                  operator: {
                    id: "operator_1",
                    name: "Operator",
                    email: "operator@ecs.local",
                  },
                  body: "Called merchant about billing.",
                  visibility: "internal",
                  createdAt: "2026-06-02T10:00:00.000Z",
                },
              ],
              auditLogs: [
                {
                  id: "audit_1",
                  actorUserId: "operator_1",
                  actor: {
                    id: "operator_1",
                    name: "Operator",
                    email: "operator@ecs.local",
                  },
                  action: "tenant.status_changed",
                  targetType: "tenant",
                  targetId: "tenant_1",
                  metadata: {
                    status: "suspended",
                  },
                  createdAt: "2026-06-02T11:00:00.000Z",
                },
              ],
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support?limit=5");

    assert.equal(response.status, 200);
    assert.deepEqual(historyInput, {
      tenantId: "tenant_1",
      limit: 5,
    });
    assert.deepEqual(await response.json(), {
      history: {
        notes: [
          {
            id: "note_1",
            operatorUserId: "operator_1",
            operator: {
              id: "operator_1",
              name: "Operator",
              email: "operator@ecs.local",
            },
            body: "Called merchant about billing.",
            visibility: "internal",
            createdAt: "2026-06-02T10:00:00.000Z",
          },
        ],
        auditLogs: [
          {
            id: "audit_1",
            actorUserId: "operator_1",
            actor: {
              id: "operator_1",
              name: "Operator",
              email: "operator@ecs.local",
            },
            action: "tenant.status_changed",
            targetType: "tenant",
            targetId: "tenant_1",
            createdAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
    });
  });

  it("lets an operator add a tenant support note", async () => {
    let noteInput:
      | {
          body: string;
          operatorUserId: string;
          tenantId: string;
          visibility?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createOperatorSupportNote: async (input) => {
          noteInput = input;

          return {
            ok: true,
            note: {
              id: "note_1",
              operatorUserId: input.operatorUserId,
              operator: null,
              body: input.body,
              visibility: input.visibility ?? "internal",
              createdAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support/notes", {
      body: JSON.stringify({
        body: " Called merchant about billing. ",
        visibility: " internal ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.deepEqual(noteInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      body: "Called merchant about billing.",
      visibility: "internal",
    });
    assert.deepEqual(await response.json(), {
      note: {
        id: "note_1",
        operatorUserId: "operator_1",
        operator: null,
        body: "Called merchant about billing.",
        visibility: "internal",
        createdAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("rejects oversized internal support notes before persistence", async () => {
    let created = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createOperatorSupportNote: async () => {
          created = true;
          throw new Error("should_not_run");
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support/notes", {
      body: JSON.stringify({ body: "x".repeat(4_001) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(created, false);
  });

  it("grants temporary support access only through recent exact platform authority", async () => {
    let permissionSeen: string | undefined;
    let grantInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        createSupportAccessGrant: async (input) => {
          grantInput = input;
          return {
            ok: true,
            grant: {
              id: "grant_1",
              operatorUserId: input.operatorUserId,
              reason: input.reason,
              expiresAt: input.expiresAt.toISOString(),
              revokedAt: null,
              revokeReason: null,
              createdAt: new Date().toISOString(),
            },
          };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
      },
    );
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const response = await app.request("/platform/operator/tenants/tenant_1/support-access", {
      body: JSON.stringify({ expiresAt, reason: "Investigating support case ECS-100" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 201);
    assert.equal(permissionSeen, "tenants.support.access.manage");
    assert.deepEqual(grantInput, {
      expiresAt: new Date(expiresAt),
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Investigating support case ECS-100",
      tenantId: "tenant_1",
    });
  });

  it("does not treat an operator tenant membership as platform authority", async () => {
    let mutated = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        updateTenantStatus: async () => {
          mutated = true;
          return { ok: false, error: "tenant_not_found", status: 404 };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({ status: "suspended" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.equal(mutated, false);
  });

  it("requires recent authentication for high-risk platform mutations", async () => {
    let mutated = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          session: { createdAt: new Date(Date.now() - 11 * 60 * 1_000) },
          user: { id: "user_1", email: "ops@ecs.local", name: "Ops" },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        updateTenantStatus: async () => {
          mutated = true;
          return { ok: false, error: "tenant_not_found", status: 404 };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({ status: "suspended" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "reauthentication_required" });
    assert.equal(mutated, false);
  });

  it("lists only the allowlisted tenant projection with tenants.read", async () => {
    let listInput: unknown;
    const tenant = {
      id: "tenant_1",
      name: "Abebe Market",
      handle: "abebe",
      ownerEmail: "owner@abebe.example",
      status: "active" as const,
      primaryDomainHostname: "abebe.lvh.me",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({ user: { id: "user_1", email: "ops@ecs.local", name: "Ops" } }),
        authorizePlatformPermission: async ({ permission, userId }) =>
          permission === "tenants.read"
            ? { ok: true, permission, principal: { id: "principal_1", userId } }
            : { ok: false },
        listSuperadminTenants: async (input) => {
          listInput = input;
          return { tenants: [tenant], count: 1, limit: input.limit, offset: input.offset };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants?q=abebe&limit=10&offset=20");
    assert.equal(response.status, 200);
    assert.deepEqual(listInput, { query: "abebe", limit: 10, offset: 20 });
    assert.deepEqual(await response.json(), { tenants: [tenant], count: 1, limit: 10, offset: 20 });
  });
});
