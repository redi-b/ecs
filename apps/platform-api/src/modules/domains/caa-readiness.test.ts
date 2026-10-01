import assert from "node:assert/strict";
import { it } from "node:test";
import { createDomainCaaProbe } from "./caa-readiness.js";

type CaaRecord = { critical: number; [tag: string]: string | number };

it("checks the closest CAA set, including resolver-chased aliases, before parent inheritance", async () => {
  const checked: string[] = [];
  const probe = createDomainCaaProbe({
    createResolver: () => ({
      resolveCaa: async (name) => {
        checked.push(name);
        if (name === "shop.example.com") return [];
        return [{ critical: 0, issue: "other-ca.example" }];
      },
      cancel: () => {},
    }),
  });
  assert.deepEqual(await probe("shop.example.com"), {
    ok: true,
    allowed: false,
    checkedHostname: "example.com",
    reason: "issuer_not_allowed",
  });
  assert.deepEqual(checked, ["shop.example.com", "example.com"]);
  const aliasProbe = createDomainCaaProbe({
    createResolver: () => ({
      // DNS CAA lookup chases the CNAME; do not climb the alias target's parents.
      resolveCaa: async () => [{ critical: 0, issue: "letsencrypt.org" }],
      cancel: () => {},
    }),
  });
  assert.deepEqual(await aliasProbe("shop.example.com"), {
    ok: true,
    allowed: true,
    checkedHostname: "shop.example.com",
    reason: "allowed",
  });
});

it("requires an applicable Let’s Encrypt HTTP-01 grant and respects critical and account restrictions", async () => {
  let records: CaaRecord[] = [];
  const probe = createDomainCaaProbe({
    createResolver: () => ({ resolveCaa: async () => records, cancel: () => {} }),
  });
  const cases: { records: CaaRecord[]; reason: string }[] = [
    { records: [{ critical: 0, issue: ";" }], reason: "issuer_not_allowed" },
    {
      records: [{ critical: 0, issue: "letsencrypt.org; validationmethods=dns-01" }],
      reason: "http01_not_allowed",
    },
    {
      records: [{ critical: 0, issue: "letsencrypt.org; accounturi=https://acme.example/acct/1" }],
      reason: "account_restricted",
    },
    {
      records: [
        { critical: 128, unknown: "restriction" },
        { critical: 0, issue: "letsencrypt.org" },
      ],
      reason: "unknown_critical_property",
    },
    {
      records: [{ critical: 0, issue: "letsencrypt.org; unknown=value" }],
      reason: "unsupported_parameters",
    },
    { records: [{ critical: -1, issue: "letsencrypt.org" }], reason: "invalid_record" },
  ];
  for (const entry of cases) {
    records = entry.records;
    const result = await probe("shop.example.com");
    assert.ok(result.ok);
    if (!result.ok) continue;
    assert.equal(result.allowed, false);
    assert.equal(result.reason, entry.reason);
  }
  const grants: CaaRecord[][] = [
    [{ critical: 0, issuewild: ";" }],
    [{ critical: 128, iodef: "mailto:security@example.com" }],
    [{ critical: 0, unknown: "ignored" }],
    [{ critical: 0, issue: "letsencrypt.org; validationmethods=dns-01,http-01" }],
    [
      { critical: 0, issue: ";" },
      { critical: 0, issue: "letsencrypt.org" },
    ],
  ];
  for (const granted of grants) {
    records = granted;
    const result = await probe("shop.example.com");
    assert.ok(result.ok && result.allowed);
  }
  records = [{ critical: 0, issue: "letsencrypt.org; accounturi=https://acme.example/acct/1" }];
  const knownAccount = createDomainCaaProbe({
    accountUri: "https://acme.example/acct/1",
    createResolver: () => ({ resolveCaa: async () => records, cancel: () => {} }),
  });
  const result = await knownAccount("shop.example.com");
  assert.ok(result.ok && result.allowed);
});

it("allows absent CAA but retries lookup failures and bounds the entire parent walk", async () => {
  let code = "ENODATA";
  const probe = createDomainCaaProbe({
    createResolver: () => ({
      resolveCaa: async () => {
        throw Object.assign(new Error("Lookup failed"), { code });
      },
      cancel: () => {},
    }),
  });
  assert.deepEqual(await probe("shop.example.com"), {
    ok: true,
    allowed: true,
    checkedHostname: null,
    reason: "allowed",
  });
  code = "ESERVFAIL";
  assert.deepEqual(await probe("shop.example.com"), { ok: false, error: "caa_lookup_failed" });
  let cancelled = false;
  let lookups = 0;
  const slow = createDomainCaaProbe({
    timeoutMs: 10,
    createResolver: () => ({
      resolveCaa: () => {
        lookups++;
        return new Promise((resolve) => setTimeout(() => resolve([]), 40));
      },
      cancel: () => {
        cancelled = true;
      },
    }),
  });
  assert.deepEqual(await slow("shop.example.com"), { ok: false, error: "caa_lookup_failed" });
  assert.equal(cancelled, true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(lookups, 1, "No parent lookups may start after the deadline");
});
