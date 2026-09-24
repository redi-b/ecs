import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("plan administration", () => {
  it("keeps plan reads, publication, and subscription migration behind exact permissions", async () => {
    const permissions: string[] = [];
    let publishInput: unknown;
    let migrationInput: unknown;
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
        getPlanAdministrationCatalog: async () => ({ plans: [] }),
        publishPlanDraft: async (input) => {
          publishInput = input;
          return { ok: true, publication: { action: "published" } } as never;
        },
        migrateSubscriptionPlanVersion: async (input) => {
          migrationInput = input;
          return { ok: true, subscriptionId: "subscription_1" };
        },
      },
    );

    assert.equal((await app.request("/platform/operator/billing/plans")).status, 200);
    assert.equal(
      (
        await app.request("/platform/operator/billing/plans/plan_1/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "Publish reviewed commercial terms" }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await app.request("/platform/operator/tenants/tenant_1/billing/plan-version", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planVersionId: "version_2",
            reason: "Move this merchant after support approval",
          }),
        })
      ).status,
      200,
    );
    assert.deepEqual(permissions, [
      "billing.plans.read",
      "billing.plans.update",
      "billing.subscriptions.update",
    ]);
    assert.deepEqual(publishInput, {
      actorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      planId: "plan_1",
      reason: "Publish reviewed commercial terms",
    });
    assert.deepEqual(migrationInput, {
      actorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      planVersionId: "version_2",
      reason: "Move this merchant after support approval",
      tenantId: "tenant_1",
    });
  });
});
