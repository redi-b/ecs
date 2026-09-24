import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePlanEntitlements } from "./catalog.js";
import { createEntitlementService, resolveEntitlement } from "./service.js";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("resolveEntitlement", () => {
  it("fails closed for missing, malformed, and unknown plan capability values", () => {
    assert.deepEqual(parsePlanEntitlements(undefined), { customDomains: false });
    assert.deepEqual(parsePlanEntitlements({ customDomains: "yes" }), {
      customDomains: false,
    });
    assert.deepEqual(parsePlanEntitlements({ futureFeature: true }), {
      customDomains: false,
    });
  });

  it("rejects permanent overrides before persistence", async () => {
    const result = await createEntitlementService({} as never).createOverride({
      expiresAt: null,
      key: "customDomains",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Permanent exceptions are unsafe",
      tenantId: "tenant_1",
      value: true,
    });
    assert.deepEqual(result, {
      ok: false,
      error: "entitlement_override_invalid",
      status: 400,
    });
  });

  it("allows an enabled plan feature for an active subscription", () => {
    assert.deepEqual(
      resolveEntitlement({
        key: "customDomains",
        now,
        overrides: [],
        planFeatures: { customDomains: true },
        subscriptionStatus: "active",
      }),
      {
        allowed: true,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      },
    );
  });

  it("denies access when billing state is not eligible even with an override", () => {
    const decision = resolveEntitlement({
      key: "customDomains",
      now,
      overrides: [
        {
          createdAt: new Date("2026-08-25T10:00:00.000Z"),
          expiresAt: null,
          revokedAt: null,
          value: true,
        },
      ],
      planFeatures: { customDomains: true },
      subscriptionStatus: "past_due",
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.source, "subscription");
  });

  it("uses the newest active override and ignores expired or revoked overrides", () => {
    const decision = resolveEntitlement({
      key: "customDomains",
      now,
      overrides: [
        {
          createdAt: new Date("2026-08-25T11:00:00.000Z"),
          expiresAt: new Date("2026-08-25T11:30:00.000Z"),
          revokedAt: null,
          value: true,
        },
        {
          createdAt: new Date("2026-08-25T10:30:00.000Z"),
          expiresAt: null,
          revokedAt: new Date("2026-08-25T11:30:00.000Z"),
          value: true,
        },
        {
          createdAt: new Date("2026-08-25T10:00:00.000Z"),
          expiresAt: null,
          revokedAt: null,
          value: false,
        },
      ],
      planFeatures: { customDomains: true },
      subscriptionStatus: "active",
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.source, "override");
  });

  it("fails closed when no subscription exists", () => {
    const decision = resolveEntitlement({
      key: "customDomains",
      now,
      overrides: [],
      planFeatures: { customDomains: true },
      subscriptionStatus: null,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.source, "missing");
  });
});
