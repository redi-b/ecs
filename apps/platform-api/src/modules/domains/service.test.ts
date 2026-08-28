import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDomainManagementService,
  hasDomainOwnershipRecord,
  isValidCustomDomainHostname,
} from "./service.js";

describe("domain entitlement enforcement", () => {
  it("accepts only an exact TXT challenge and rejects IP-literal hostnames", () => {
    assert.equal(
      hasDomainOwnershipRecord(
        [["unrelated"], [" ecs-domain-verification=expected-token "]],
        "ecs-domain-verification=expected-token",
      ),
      true,
    );
    assert.equal(
      hasDomainOwnershipRecord(
        [["ecs-domain-verification=expected-token.attacker"]],
        "ecs-domain-verification=expected-token",
      ),
      false,
    );
    assert.equal(isValidCustomDomainHostname("127.0.0.1"), false);
    assert.equal(isValidCustomDomainHostname("shop.example.com"), true);
  });

  it("rejects custom-domain creation before touching persistence when not entitled", async () => {
    const service = createDomainManagementService({} as never, {
      customDomainsAvailable: true,
      evaluateEntitlement: async () => ({
        allowed: false,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      }),
    });

    const result = await service.createTenantDomain({
      hostname: "shop.example.com",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "entitlement_required",
      status: 403,
    });
  });

  it("keeps custom-domain creation unavailable by default even for an entitled tenant", async () => {
    let evaluated = false;
    const service = createDomainManagementService({} as never, {
      evaluateEntitlement: async () => {
        evaluated = true;
        return {
          allowed: true,
          key: "customDomains",
          source: "plan",
          subscriptionStatus: "active",
        };
      },
    });

    const result = await service.createTenantDomain({
      hostname: "shop.example.com",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "custom_domains_unavailable",
      status: 503,
    });
    assert.equal(evaluated, false);
  });

  it("does not permit callers to construct domain management without an entitlement gate", () => {
    assert.throws(
      () => createDomainManagementService({} as never, undefined as never),
      /evaluateEntitlement/,
    );
  });
});
