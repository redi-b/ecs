import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMerchantDomain, getMerchantDomains } from "./domains.js";

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
  it("validates the domain list and preserves the DNS challenge", async () => {
    const result = await getMerchantDomains({
      fetcher: async () => Response.json({ domains: [domain] }),
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
    });
    assert.deepEqual(result, { ok: true, domains: [domain] });
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
