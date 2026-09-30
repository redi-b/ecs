import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCommerceEventIdentity,
  getMedusaEventOccurrenceId,
  merchantOperationChannelSchema,
} from "./merchant-operation-events.js";

describe("merchant operation event identity", () => {
  it("refuses to guess an identity for a repeatable event without stable occurrence metadata", () => {
    assert.equal(
      getMedusaEventOccurrenceId({
        cardinality: "repeatable",
        metadata: {},
        subjectId: "ilevel_1",
      }),
      null,
    );
  });

  it("builds a stable retry identity and changes it for a later occurrence", () => {
    const firstOccurrence = getMedusaEventOccurrenceId({
      cardinality: "repeatable",
      metadata: { created_at: "2026-09-29T10:00:00.000Z", eventGroupId: "group_1" },
      subjectId: "ilevel_1",
    });
    const retryOccurrence = getMedusaEventOccurrenceId({
      cardinality: "repeatable",
      metadata: { created_at: new Date("2026-09-29T10:00:00.000Z"), eventGroupId: "group_1" },
      subjectId: "ilevel_1",
    });
    const nextOccurrence = getMedusaEventOccurrenceId({
      cardinality: "repeatable",
      metadata: { created_at: "2026-09-29T10:01:00.000Z", eventGroupId: "group_2" },
      subjectId: "ilevel_1",
    });

    assert.equal(firstOccurrence, retryOccurrence);
    assert.notEqual(firstOccurrence, nextOccurrence);
    assert.ok(firstOccurrence);
    assert.equal(
      buildCommerceEventIdentity({
        eventName: "inventory-level.updated",
        occurrenceId: firstOccurrence,
        origin: "medusa",
        subjectId: "ilevel_1",
        subjectType: "inventory_level",
      }),
      `v1:medusa:inventory-level.updated:inventory_level:ilevel_1:${encodeURIComponent(firstOccurrence)}`,
    );
  });

  it("keeps merchant channel separate from event origin", () => {
    assert.equal(merchantOperationChannelSchema.parse("assisted_sale"), "assisted_sale");
    assert.equal(merchantOperationChannelSchema.safeParse("medusa").success, false);
  });
});
