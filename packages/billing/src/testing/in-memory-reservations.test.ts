import assert from "node:assert/strict";
import test from "node:test";

import { defineCapabilityCatalog } from "../catalog.js";
import type { AccountId, ReservationId } from "../domain.js";
import { decideCapability } from "../policy.js";
import { createInMemoryCapacityReservations } from "./in-memory-reservations.js";

const catalog = defineCapabilityCatalog({
  products: { kind: "limit", defaultValue: 0, window: "lifetime" },
});

test("concurrent reservations never oversubscribe a hard limit", async () => {
  let nextId = 0;
  const accountId = "tenant-1" as AccountId;
  const service = createInMemoryCapacityReservations<typeof catalog>({
    clock: { now: () => new Date("2026-08-28T00:00:00Z") },
    identifiers: { create: () => `reservation-${++nextId}` as ReservationId },
    decide: async ({ amount, capability, reserved, used }) =>
      decideCapability({
        amount,
        capability,
        definition: catalog[capability],
        reserved,
        status: "active",
        used,
        value: 1,
      }),
  });
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      service.reserve({
        accountId,
        amount: 1,
        capability: "products",
        idempotencyKey: `create-${index}`,
        ttlSeconds: 30,
      }),
    ),
  );
  const granted = results.filter((result) => result.reservation);
  assert.equal(granted.length, 1);
  const reservation = granted[0]?.reservation;
  assert.ok(reservation);
  await service.commit(reservation.id);
  assert.equal(service.getConsumed("tenant-1:products"), 1);
});

test("reserve and commit are idempotent", async () => {
  let nextId = 0;
  const accountId = "tenant-2" as AccountId;
  const service = createInMemoryCapacityReservations<typeof catalog>({
    clock: { now: () => new Date("2026-08-28T00:00:00Z") },
    identifiers: { create: () => `reservation-${++nextId}` as ReservationId },
    decide: async ({ amount, capability, reserved, used }) =>
      decideCapability({
        amount,
        capability,
        definition: catalog[capability],
        reserved,
        status: "active",
        used,
        value: 2,
      }),
  });
  const request = {
    accountId,
    amount: 1,
    capability: "products" as const,
    idempotencyKey: "same",
    ttlSeconds: 30,
  };
  const first = await service.reserve(request);
  const second = await service.reserve(request);
  assert.equal(first.reservation?.id, second.reservation?.id);
  assert.ok(first.reservation);
  await service.commit(first.reservation.id);
  await service.commit(first.reservation.id);
  assert.equal(service.getConsumed("tenant-2:products"), 1);
});
