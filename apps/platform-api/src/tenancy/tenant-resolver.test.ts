import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TenantDomainRecord } from "./tenant-resolver.js";
import { normalizeHostname, resolveTenantFromHost } from "./tenant-resolver.js";

const activePublishedRecord: TenantDomainRecord = {
  domainId: "domain_1",
  hostname: "abebe.lvh.me",
  domainStatus: "active",
  verificationStatus: "verified",
  tenantId: "tenant_1",
  tenantName: "Abebe Market",
  tenantHandle: "abebe",
  tenantStatus: "active",
  medusaStoreId: "store_1",
  medusaSalesChannelId: "channel_1",
  medusaPublishableKeyId: "pk_1",
  medusaRegionId: "reg_1",
  publishedRevisionId: "revision_1",
  templateId: "template_1",
  templateVersion: 1,
};

function resolverFor(record?: TenantDomainRecord) {
  return resolveTenantFromHost({
    host: "Abebe.lvh.me:443",
    platformBaseDomain: "lvh.me",
    systemHosts: ["api.lvh.me", "dashboard.lvh.me"],
    findDomainByHostname: async (hostname) => (hostname === record?.hostname ? record : undefined),
  });
}

describe("normalizeHostname", () => {
  it("lowercases hostnames and removes ports and trailing dots", () => {
    assert.equal(normalizeHostname("Abebe.LVH.me.:443"), "abebe.lvh.me");
  });
});

describe("resolveTenantFromHost", () => {
  it("requires shop context when host is missing", async () => {
    const result = await resolveTenantFromHost({
      host: undefined,
      platformBaseDomain: "lvh.me",
      systemHosts: ["api.lvh.me"],
      findDomainByHostname: async () => undefined,
    });

    assert.deepEqual(result, { ok: false, error: "shop_context_required" });
  });

  it("requires trusted context for system hosts", async () => {
    const result = await resolveTenantFromHost({
      host: "api.lvh.me",
      platformBaseDomain: "lvh.me",
      systemHosts: ["api.lvh.me", "dashboard.lvh.me"],
      findDomainByHostname: async () => activePublishedRecord,
    });

    assert.deepEqual(result, { ok: false, error: "shop_context_required" });
  });

  it("returns shop_not_found when no domain record matches the host", async () => {
    const result = await resolverFor();

    assert.deepEqual(result, { ok: false, error: "shop_not_found" });
  });

  it("blocks domains that are not active and verified", async () => {
    const result = await resolverFor({
      ...activePublishedRecord,
      domainStatus: "pending_verification",
    });

    assert.deepEqual(result, { ok: false, error: "domain_misconfigured" });
  });

  it("blocks suspended tenants", async () => {
    const result = await resolverFor({
      ...activePublishedRecord,
      tenantStatus: "suspended",
    });

    assert.deepEqual(result, { ok: false, error: "shop_suspended" });
  });

  it("blocks active tenants without a published storefront revision", async () => {
    const result = await resolverFor({
      ...activePublishedRecord,
      publishedRevisionId: null,
    });

    assert.deepEqual(result, { ok: false, error: "shop_unpublished" });
  });

  it("returns tenant context for an active verified published shop", async () => {
    const result = await resolverFor(activePublishedRecord);

    assert.deepEqual(result, {
      ok: true,
      context: {
        tenantId: "tenant_1",
        tenantName: "Abebe Market",
        tenantHandle: "abebe",
        hostname: "abebe.lvh.me",
        domainId: "domain_1",
        status: "active",
        medusaStoreId: "store_1",
        medusaSalesChannelId: "channel_1",
        medusaPublishableKeyId: "pk_1",
        medusaRegionId: "reg_1",
        publishedRevisionId: "revision_1",
        templateId: "template_1",
        templateVersion: 1,
      },
    });
  });
});
