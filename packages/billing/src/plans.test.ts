import assert from "node:assert/strict";
import test from "node:test";

import { defineCapabilityCatalog } from "./catalog.js";
import type { PlanId, PlanVersionId } from "./domain.js";
import { canonicalPlanTerms, publishPlanVersion } from "./plans.js";

const catalog = defineCapabilityCatalog({
  customDomains: { kind: "boolean", defaultValue: false },
  products: { kind: "limit", defaultValue: 0, window: "lifetime" },
});
const planId = "plan-growth" as PlanId;
const terms = {
  capabilities: { customDomains: true, products: 500 },
  currency: "ETB",
  interval: "month",
  priceMinor: 100_00,
} as const;

test("canonical terms do not depend on object key insertion order", () => {
  const reordered = {
    priceMinor: 100_00,
    interval: "month",
    currency: "ETB",
    capabilities: { products: 500, customDomains: true },
  } as const;
  assert.equal(
    canonicalPlanTerms({ catalog, terms }),
    canonicalPlanTerms({ catalog, terms: reordered }),
  );
});

test("publishing identical terms returns the existing immutable version", async () => {
  let identifiersCreated = 0;
  const first = await publishPlanVersion({
    catalog,
    fingerprint: { digest: async (value) => `digest:${value}` },
    identifiers: {
      create: () => {
        identifiersCreated += 1;
        return "version-1" as PlanVersionId;
      },
    },
    latest: null,
    now: new Date("2026-08-28T00:00:00Z"),
    planId,
    terms,
  });
  const second = await publishPlanVersion({
    catalog,
    fingerprint: { digest: async (value) => `digest:${value}` },
    identifiers: {
      create: () => {
        identifiersCreated += 1;
        return "version-2" as PlanVersionId;
      },
    },
    latest: first.version,
    now: new Date("2026-08-29T00:00:00Z"),
    planId,
    terms,
  });
  assert.equal(first.action, "published");
  assert.equal(second.action, "unchanged");
  assert.equal(second.version, first.version);
  assert.equal(identifiersCreated, 1);
});

test("changed terms create the next version without mutating the previous version", async () => {
  let nextId = 0;
  const identifiers = { create: () => `version-${++nextId}` as PlanVersionId };
  const fingerprint = { digest: async (value: string) => `digest:${value}` };
  const first = await publishPlanVersion({
    catalog,
    fingerprint,
    identifiers,
    latest: null,
    now: new Date("2026-08-28T00:00:00Z"),
    planId,
    terms,
  });
  const second = await publishPlanVersion({
    catalog,
    fingerprint,
    identifiers,
    latest: first.version,
    now: new Date("2026-08-29T00:00:00Z"),
    planId,
    terms: { ...terms, capabilities: { ...terms.capabilities, products: 1_000 } },
  });
  assert.equal(second.action, "published");
  assert.equal(second.version.version, 2);
  assert.equal(first.version.terms.capabilities.products, 500);
  assert.equal(second.version.terms.capabilities.products, 1_000);
});

test("plans cannot omit catalog capabilities", () => {
  assert.throws(
    () =>
      canonicalPlanTerms({
        catalog,
        terms: {
          ...terms,
          capabilities: { customDomains: true } as typeof terms.capabilities,
        },
      }),
    /exactly match/,
  );
});
