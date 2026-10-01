import assert from "node:assert/strict";
import { it } from "node:test";
import { decideDomainLifecycle } from "./lifecycle.js";

const now = Date.UTC(2026, 9, 1);
const initial = { status: "pending_verification" as const, activatedAt: null, failureSince: null };
const evidence = { ownership: true, dns: "ready" as const, https: "valid" as const };

it("admits a domain only after ownership, ingress DNS and expected-shop HTTPS pass", () => {
  const verified = decideDomainLifecycle(initial, evidence, now);
  assert.equal(verified.status, "active");
  assert.equal(verified.routeDesired, true);
  assert.equal(verified.admitStorefront, true);
  for (const [observed, expected] of [
    [{ ...evidence, ownership: false }, "pending_verification"],
    [{ ...evidence, dns: "missing" }, "pending_dns"],
    [{ ...evidence, https: "pending" }, "pending_certificate"],
  ] as const) {
    const result = decideDomainLifecycle(initial, observed, now);
    assert.equal(result.status, expected);
    assert.equal(result.admitStorefront, false);
    assert.equal(result.routeDesired, expected === "pending_certificate");
  }
});

it("withdraws immediately for explicit removal, unsafe DNS or wrong-shop HTTPS", () => {
  const active = { status: "active" as const, activatedAt: now - 1000, failureSince: null };
  for (const [state, observed, expected] of [
    [{ ...active, status: "removing" }, evidence, "removing"],
    [active, { ...evidence, dns: "unsafe" }, "failed"],
    [active, { ...evidence, ownership: false, dns: "unsafe" }, "failed"],
    [active, { ...evidence, ownership: false, https: "wrong_shop" }, "failed"],
  ] as const) {
    const result = decideDomainLifecycle(state, observed, now);
    assert.equal(result.status, expected);
    assert.equal(result.routeDesired, false);
    assert.equal(result.admitStorefront, false);
  }
});

it("preserves an activated route for exactly seven days of accidental DNS or TXT breakage", () => {
  const active = { status: "active" as const, activatedAt: now - 1000, failureSince: null };
  for (const observed of [
    { ...evidence, ownership: false },
    { ...evidence, dns: "missing" as const },
  ]) {
    const first = decideDomainLifecycle(active, observed, now);
    assert.equal(first.status, "misconfigured");
    assert.equal(first.routeDesired, true);
    assert.equal(first.admitStorefront, true);
    assert.equal(first.failureSince, now);
    const lastGrace = decideDomainLifecycle(first, observed, now + 7 * 86400000 - 1);
    assert.equal(lastGrace.routeDesired, true);
    assert.equal(lastGrace.failureSince, now);
    const expired = decideDomainLifecycle(first, observed, now + 7 * 86400000);
    assert.equal(expired.routeDesired, false);
    assert.equal(expired.admitStorefront, false);
    assert.equal(expired.failureSince, now);
    const repaired = decideDomainLifecycle(first, evidence, now + 86400000);
    assert.equal(repaired.status, "active");
    assert.equal(repaired.failureSince, null);
  }
});

it("does not admit invalid HTTPS and rejects invalid or future grace timestamps", () => {
  const active = { status: "active" as const, activatedAt: now - 1000, failureSince: null };
  assert.equal(
    decideDomainLifecycle(active, { ...evidence, https: "invalid" }, now).admitStorefront,
    false,
  );
  assert.equal(
    decideDomainLifecycle(active, { ...evidence, ownership: false, https: "invalid" }, now)
      .admitStorefront,
    false,
  );
  for (const state of [
    { ...active, failureSince: now + 1 },
    { ...active, activatedAt: Number.NaN },
  ]) {
    assert.throws(() => decideDomainLifecycle(state, evidence, now), /timestamp/);
  }
  assert.throws(() => decideDomainLifecycle(initial, evidence, Number.NaN), /timestamp/);
});

it("does not resurrect a failed domain through warning grace without full recovery evidence", () => {
  const failed = { status: "failed" as const, activatedAt: now - 1000, failureSince: null };
  const result = decideDomainLifecycle(failed, { ...evidence, ownership: false }, now);
  assert.equal(result.routeDesired, false);
  assert.equal(result.admitStorefront, false);
  assert.equal(
    decideDomainLifecycle(result, { ...evidence, ownership: false }, now + 1000).routeDesired,
    false,
  );
  assert.equal(decideDomainLifecycle(failed, evidence, now).status, "active");
});

it("uses historical TLS only during established DNS/TXT grace, never for new activation", () => {
  const unobserved = { ...evidence, https: "not_observed" as const };
  assert.equal(decideDomainLifecycle(initial, unobserved, now).admitStorefront, false);
  assert.equal(decideDomainLifecycle(initial, unobserved, now).status, "pending_certificate");
  const active = {
    status: "active" as const,
    activatedAt: now - 1000,
    failureSince: null,
    httpsVerified: true,
  };
  const warning = decideDomainLifecycle(active, { ...unobserved, ownership: false }, now);
  assert.equal(warning.status, "misconfigured");
  assert.equal(warning.admitStorefront, true);
  assert.equal(warning.failureSince, now);
  assert.equal(
    decideDomainLifecycle(
      { ...active, httpsVerified: false },
      { ...unobserved, ownership: false },
      now,
    ).admitStorefront,
    false,
  );
  assert.equal(
    decideDomainLifecycle(warning, { ...unobserved, ownership: false }, now + 7 * 86400000)
      .routeDesired,
    false,
  );
});
