import assert from "node:assert/strict";
import { it } from "node:test";
import { resolveTenantFromHost } from "../../context/tenant-resolver.js";
import { createDomainProbeIdentityService } from "./probe-identity.js";

it("returns only exact verified pending-certificate identity without admitting the storefront", async () => {
  const row = {
    hostname: "shop.example.com",
    domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
    tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
    tenantStatus: "active",
    domainType: "custom_domain",
    verificationStatus: "verified",
    domainStatus: "pending_certificate",
    sslStatus: "pending",
    activatedAt: null,
    warningSince: null,
    warningReason: null,
  };
  const service = createDomainProbeIdentityService({
    enabled: true,
    platformBaseDomain: "ecset.dev",
    findDomainByHostname: async (hostname) => {
      assert.equal(hostname, row.hostname);
      return row;
    },
    evaluateEntitlement: async () => ({
      allowed: true,
      key: "customDomains",
      source: "plan",
      subscriptionStatus: "active",
    }),
  });
  const nonce = "a".repeat(32);
  assert.deepEqual(await service({ hostname: row.hostname, nonce }), {
    version: 1,
    hostname: row.hostname,
    tenantId: row.tenantId,
    domainId: row.domainId,
    nonce,
  });
  const ordinary = await resolveTenantFromHost({
    host: row.hostname,
    platformBaseDomain: "ecset.dev",
    systemHosts: [],
    findDomainByHostname: async () => row as never,
  });
  assert.deepEqual(ordinary, { ok: false, error: "domain_misconfigured" });
});

it("fails closed when disabled, unauthorized, reserved, removing or expired", async () => {
  const now = Date.now();
  const row = {
    hostname: "shop.example.com",
    domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
    tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
    tenantStatus: "active",
    domainType: "custom_domain",
    verificationStatus: "verified",
    domainStatus: "pending_certificate",
    sslStatus: "pending",
    activatedAt: null as Date | null,
    warningSince: null as Date | null,
    warningReason: null as string | null,
  };
  let allowed = true;
  let lookups = 0;
  const options = {
    enabled: true,
    platformBaseDomain: "ECSET.DEV",
    findDomainByHostname: async () => {
      lookups++;
      return row;
    },
    evaluateEntitlement: async () => ({
      allowed,
      key: "customDomains" as const,
      source: "plan" as const,
      subscriptionStatus: "active" as const,
    }),
  };
  const input = () => ({ hostname: row.hostname, nonce: "a".repeat(32) });
  assert.equal(
    await createDomainProbeIdentityService({ ...options, enabled: false })(input()),
    undefined,
  );
  assert.equal(lookups, 0);
  const probe = createDomainProbeIdentityService(options);
  allowed = false;
  assert.equal(await probe(input()), undefined);
  allowed = true;
  for (const hostname of ["shop.et", "shop.ecset.dev", "ecset.dev"]) {
    row.hostname = hostname;
    assert.equal(await probe(input()), undefined, hostname);
  }
  row.hostname = "shop.example.com";
  for (const status of ["removing", "failed", "pending_dns", "pending_verification", "active"]) {
    row.domainStatus = status;
    assert.equal(await probe(input()), undefined, status);
  }
  row.domainStatus = "active";
  row.sslStatus = "active";
  row.activatedAt = new Date(now - 1000);
  assert.ok(await probe(input()));
  row.domainStatus = "misconfigured";
  row.warningReason = "dns_missing";
  row.warningSince = new Date(now);
  assert.ok(await probe(input()));
  row.activatedAt = new Date(now - 9 * 86400000);
  row.warningSince = new Date(now - 8 * 86400000);
  assert.equal(await probe(input()), undefined);
  row.domainStatus = "pending_certificate";
  row.tenantStatus = "suspended";
  assert.equal(await probe(input()), undefined);
  row.tenantStatus = "active";
  row.verificationStatus = "pending";
  assert.equal(await probe(input()), undefined);
});
