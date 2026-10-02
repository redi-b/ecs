import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMerchantDomain, getMerchantDomains, removeMerchantDomain } from "./domains.js";

const domain = {
  id: "domain_1",
  hostname: "shop.example.com",
  type: "custom_domain",
  status: "pending_verification",
  isPrimary: false,
  verificationStatus: "pending",
  sslStatus: "pending",
  verificationChallenge: {
    recordName: "_ecs-verification.shop.example.com",
    recordValue: "ecs-domain-verification=token",
    expiresAt: "2026-09-01T00:00:00.000Z",
  },
};

describe("merchant domains client", () => {
  it("preserves safe setup and readiness diagnostics for merchant instructions", async () => {
    const setup = {
      enabled: true,
      entitled: true,
      dnsTarget: "domains.ecset.dev",
      ingressIpv4: ["178.238.224.27"],
    };
    const diagnosed = {
      ...domain,
      diagnostics: {
        checkedAt: "2026-10-01T12:00:00.000Z",
        reason: "caa_restricted",
        detail: "issuer_not_allowed",
      },
      warningGraceExpiresAt: null,
    };
    assert.deepEqual(
      await getMerchantDomains({
        fetcher: async () => Response.json({ domains: [diagnosed], setup }),
        platformApiBaseUrl: "http://platform.local",
        tenantId: "tenant_1",
      }),
      {
        ok: true,
        domains: [diagnosed],
        redirectToPrimary: false,
        setup,
      },
    );
  });

  it("distinguishes accepted pending withdrawal from completed removal", async () => {
    let request: Request | undefined;
    const result = await removeMerchantDomain({
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ status: "removing" }, { status: 202 });
      },
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      domainId: "domain_1",
    });
    assert.deepEqual(result, { ok: true, status: "removing" });
    assert.equal(request?.method, "DELETE");
    assert.equal(request?.url, "http://platform.local/platform/tenants/tenant_1/domains/domain_1");
  });
  it("validates the domain list and preserves the DNS challenge", async () => {
    const result = await getMerchantDomains({
      fetcher: async () => Response.json({ domains: [domain] }),
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
    });
    assert.deepEqual(result, { ok: true, domains: [domain], redirectToPrimary: false });
  });

  it("posts normalized domain input to the tenant-scoped endpoint", async () => {
    let request: Request | undefined;
    const result = await createMerchantDomain({
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ domain }, { status: 201 });
      },
      hostname: "shop.example.com",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
    });
    assert.equal(result.ok, true);
    assert.equal(request?.url, "http://platform.local/platform/tenants/tenant_1/domains");
    assert.deepEqual(await request?.json(), { hostname: "shop.example.com" });
  });
});
