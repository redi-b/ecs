import assert from "node:assert/strict";
import { it } from "node:test";
import type { TenantDomainContract } from "@ecs/contracts";
import {
  canUseDomain,
  domainConnectionStatus,
  initialChallengeExpired,
  normalizeDomainInput,
} from "./domain-settings-model.js";

const domain: TenantDomainContract = {
  id: "domain_1",
  hostname: "shop.example.com",
  type: "custom_domain",
  status: "pending_certificate",
  isPrimary: false,
  verificationStatus: "verified",
  sslStatus: "pending",
  verificationChallenge: {
    recordName: "_ecs-verification.shop.example.com",
    recordValue: "token",
    expiresAt: "2020-01-01T00:00:00.000Z",
  },
};

it("never offers ready-domain actions for partial, removing or unknown readiness", () => {
  assert.equal(canUseDomain(domain), false);
  assert.equal(canUseDomain({ ...domain, status: "active", sslStatus: "active" }), true);
  assert.equal(
    canUseDomain({
      ...domain,
      status: "active",
      sslStatus: "active",
      verificationStatus: "pending",
    }),
    false,
  );
  assert.equal(canUseDomain({ ...domain, status: "removing", sslStatus: "active" }), false);
  assert.equal(domainConnectionStatus({ ...domain, status: "legacy_active" }), "failed");
});

it("expires only initial ownership setup, never a connected challenge", () => {
  assert.equal(initialChallengeExpired(domain, Date.parse("2026-10-01T12:00:00Z")), false);
  assert.equal(
    initialChallengeExpired(
      { ...domain, status: "misconfigured", sslStatus: "active" },
      Date.now(),
    ),
    false,
  );
  assert.equal(
    initialChallengeExpired(
      { ...domain, status: "pending_verification", verificationStatus: "pending" },
      Date.now(),
    ),
    true,
  );
});

it("normalizes DNS hostnames without accepting URLs, controls, IPs, .et or platform hosts", () => {
  assert.equal(normalizeDomainInput(" SHOP.Example.Com. "), "shop.example.com");
  assert.equal(normalizeDomainInput("bücher.de"), "xn--bcher-kva.de");
  for (const value of [
    "https://shop.example.com",
    "shop.example.com/path",
    "foo\n.example.com",
    "127.0.0.1",
    "shop.example.et",
    "ecset.dev",
    "shop.ecset.dev",
    "-shop.example.com",
    "shop..com",
    "shop.example.com:443",
    "shop.example.com?x=1",
  ]) {
    assert.equal(normalizeDomainInput(value), null, value);
  }
});
