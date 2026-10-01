import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDomainManagementService,
  hasDomainOwnershipRecord,
  isValidCustomDomainHostname,
} from "./service.js";

describe("domain entitlement enforcement", () => {
  it("rechecks persistent TXT for an active domain without expiring or downgrading it", async () => {
    const domain = {
      id: "domain_1",
      hostname: "shop.example.com",
      type: "custom_domain",
      status: "active",
      isPrimary: true,
      verificationStatus: "verified",
      sslStatus: "active",
    };
    let records = [["ecs-domain-verification=token"]];
    let lookups = 0;
    let verifiedAt: Date | null = new Date(0);
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      orderBy: () => query,
      limit: async () => [
        {
          ...domain,
          challengeId: "challenge_1",
          recordName: "_ecs-verification.shop.example.com",
          recordValue: "ecs-domain-verification=token",
          verifiedAt,
          expiresAt: new Date(1),
        },
      ],
    };
    const service = createDomainManagementService(
      {
        select: () => query,
        transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            select: () => query,
            execute: async () => ({ rows: [{ acquired: true }] }),
            update: () => {
              throw new Error("Replay must not mutate lifecycle");
            },
            insert: () => {
              throw new Error("Replay must not mutate audit");
            },
          }),
      } as never,
      {
        evaluateEntitlement: async () => ({
          allowed: true,
          key: "customDomains",
          source: "plan",
          subscriptionStatus: "active",
        }),
        resolveTxt: async () => {
          lookups++;
          return records;
        },
      },
    );
    const input = { domainId: domain.id, tenantId: "tenant_1", userId: "user_1" };
    const result = await service.verifyTenantDomainOwnership(input);
    assert.deepEqual(result, { ok: true, domain });
    assert.equal(lookups, 1);
    records = [];
    assert.deepEqual(await service.verifyTenantDomainOwnership(input), {
      ok: false,
      error: "domain_verification_pending",
      status: 409,
    });
    assert.equal(lookups, 2);
    records = [["ecs-domain-verification=token"]];
    domain.status = "misconfigured";
    domain.verificationStatus = "pending";
    assert.deepEqual(await service.verifyTenantDomainOwnership(input), { ok: true, domain });
    assert.equal(lookups, 3);
    domain.status = "removing";
    assert.deepEqual(await service.verifyTenantDomainOwnership(input), {
      ok: false,
      error: "domain_not_found",
      status: 404,
    });
    assert.equal(lookups, 3);
    domain.status = "pending_verification";
    domain.verificationStatus = "pending";
    verifiedAt = null;
    assert.deepEqual(await service.verifyTenantDomainOwnership(input), {
      ok: false,
      error: "domain_verification_expired",
      status: 409,
    });
    assert.equal(lookups, 3);
  });

  it("records TXT ownership without claiming DNS or certificate readiness", async () => {
    const storedDomain = {
      id: "domain_1",
      hostname: "shop.example.com",
      type: "custom_domain",
      status: "pending_verification",
      isPrimary: false,
      verificationStatus: "pending",
      sslStatus: "pending",
    };
    const events: unknown[] = [];
    const select = {
      from: () => select,
      innerJoin: () => select,
      where: () => select,
      orderBy: () => select,
      limit: async () => [
        {
          ...storedDomain,
          verifiedAt: null,
          challengeId: "challenge_1",
          hostname: storedDomain.hostname,
          recordName: "_ecs-verification.shop.example.com",
          recordValue: "ecs-domain-verification=token",
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    };
    const transaction = {
      execute: async () => ({ rows: [{ acquired: true }] }),
      select: () => select,
      update: () => ({
        set: (changes: Record<string, unknown>) => ({
          where: () => {
            if ("status" in changes) Object.assign(storedDomain, changes);
            return { returning: async () => [storedDomain] };
          },
        }),
      }),
      insert: () => ({
        values: async (value: unknown) => {
          events.push(value);
        },
      }),
    };
    const service = createDomainManagementService(
      {
        select: () => select,
        transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      } as never,
      {
        evaluateEntitlement: async () => ({
          allowed: true,
          key: "customDomains",
          source: "plan",
          subscriptionStatus: "active",
        }),
        resolveTxt: async () => [["ecs-domain-verification=token"]],
      },
    );
    const result = await service.verifyTenantDomainOwnership({
      domainId: "domain_1",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.domain.verificationStatus, "verified");
    assert.equal(result.domain.status, "pending_dns");
    assert.equal(result.domain.sslStatus, "pending");
    assert.equal(events.length, 2);
  });

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

  it("joins chunks within a TXT record but never across records or by a matching prefix", () => {
    const expected = "ecs-domain-verification=token";
    assert.equal(hasDomainOwnershipRecord([["ecs-domain-", "verification=token"]], expected), true);
    assert.equal(
      hasDomainOwnershipRecord([["ecs-domain-"], ["verification=token"]], expected),
      false,
    );
    assert.equal(hasDomainOwnershipRecord([[expected, ".attacker"]], expected), false);
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
