import assert from "node:assert/strict";
import { it } from "node:test";
import { canPublishDomainRoute } from "./route-eligibility.js";

const now = Date.now();
const pending = {
  type: "custom_domain",
  status: "pending_certificate",
  verificationStatus: "verified",
  sslStatus: "pending",
  activatedAt: null,
  warningSince: null,
  warningReason: null,
};

it("publishes verified certificate-pending routes but not unverified, removed or failed domains", () => {
  assert.equal(canPublishDomainRoute(pending, now), true);
  for (const status of ["pending_verification", "pending_dns", "removing", "failed", "unknown"]) {
    assert.equal(canPublishDomainRoute({ ...pending, status }, now), false, status);
  }
  assert.equal(canPublishDomainRoute({ ...pending, verificationStatus: "pending" }, now), false);
  assert.equal(canPublishDomainRoute({ ...pending, type: "managed_subdomain" }, now), false);
});

it("keeps activated routes only with valid admission evidence and an unexpired DNS/TXT grace", () => {
  const active = {
    ...pending,
    status: "active",
    sslStatus: "active",
    activatedAt: new Date(now - 1000),
  };
  assert.equal(canPublishDomainRoute(active, now), true);
  assert.equal(canPublishDomainRoute({ ...active, activatedAt: null }, now), false);
  assert.equal(canPublishDomainRoute({ ...active, activatedAt: new Date(now + 1) }, now), false);
  assert.equal(canPublishDomainRoute({ ...active, sslStatus: "pending" }, now), false);
  for (const warningReason of ["dns_missing", "ownership_missing"]) {
    const grace = {
      ...active,
      status: "misconfigured",
      warningSince: new Date(now),
      warningReason,
    };
    assert.equal(canPublishDomainRoute(grace, now + 7 * 86400000 - 1), true);
    // Retaining the route permits repair; it does not admit an invalid TLS storefront.
    assert.equal(canPublishDomainRoute({ ...grace, sslStatus: "pending" }, now), true);
    assert.equal(canPublishDomainRoute(grace, now + 7 * 86400000), false);
    assert.equal(canPublishDomainRoute({ ...grace, warningSince: new Date(now + 1) }, now), false);
    assert.equal(
      canPublishDomainRoute({ ...grace, warningSince: new Date(now - 2000) }, now),
      false,
    );
    assert.equal(canPublishDomainRoute({ ...grace, warningReason: "unsafe_dns" }, now), false);
  }
  assert.throws(() => canPublishDomainRoute(active, Number.NaN), /timestamp/);
});
