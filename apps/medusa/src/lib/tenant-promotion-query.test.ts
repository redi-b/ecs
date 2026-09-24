import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantPromotionFilters, tenantPromotionQuerySchema } from "./tenant-promotion-query";

test("every promotion filter retains tenant scope and escapes campaign prefix wildcards", () => {
  for (const offer of [
    undefined,
    "order",
    "products",
    "free_shipping",
    "buyget",
    "percentage",
    "fixed",
  ] as const) {
    const input = tenantPromotionQuerySchema.parse({
      tenant_id: "tenant_1%",
      offer,
      q: "SUMMER",
      status: "active",
      apply: "automatic",
    });
    const filters = tenantPromotionFilters(input);
    assert.equal(filters.q, "SUMMER");
    assert.deepEqual(filters.$and[0], {
      $or: [
        { metadata: { platform_tenant_id: "tenant_1%" } },
        { campaign: { campaign_identifier: { $like: "ecs\\_tenant\\_1\\%\\_%" } } },
      ],
    });
    assert.ok(filters.$and.some((filter) => filter.is_automatic === true));
    assert.ok(filters.$and.some((filter) => filter.status === "active"));
  }
});

test("schedule boundary is exclusive at the end and excludes unscheduled campaigns", () => {
  const now = new Date("2026-09-07T06:00:00Z");
  const make = (schedule: string) =>
    tenantPromotionFilters(
      tenantPromotionQuerySchema.parse({ tenant_id: "one", schedule }),
      now,
    ).$and.at(-1);
  assert.deepEqual(make("expired"), { campaign: { ends_at: { $lte: now } } });
  assert.deepEqual(make("scheduled"), {
    campaign: { starts_at: { $gt: now }, $or: [{ ends_at: null }, { ends_at: { $gt: now } }] },
  });
  assert.deepEqual(make("unscheduled"), {
    $or: [{ campaign_id: null }, { campaign: { starts_at: null, ends_at: null } }],
  });
  assert.ok(JSON.stringify(make("current")).includes('"$ne":null'));
});

test("promotion list validates unsupported filters and pagination", () => {
  for (const query of [
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { schedule: "active" },
    { apply: "manual" },
    { offer: "anything" },
  ]) {
    assert.equal(
      tenantPromotionQuerySchema.safeParse({ tenant_id: "one", ...query }).success,
      false,
    );
  }
});
