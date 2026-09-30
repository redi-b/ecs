import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createInMemoryMerchantMutationStore,
  createMerchantMutationReplayService,
} from "./merchant-mutation-replay.js";

describe("merchant mutation replay", () => {
  it("returns the committed result without executing the same mutation twice", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let executions = 0;
    const input = {
      actorUserId: "user_1",
      idempotencyKey: "assist-1",
      operation: "assisted_sale.create" as const,
      payload: { items: [{ quantity: 1, variantId: "variant_1" }] },
      requestId: "request_1",
      resourceKeys: ["order:order_1"],
      source: "assisted_sale" as const,
      tenantId: "tenant_1",
    };

    const first = await service.execute(input, async () => {
      executions += 1;
      return { ok: true as const, order: { id: "order_1" } };
    });
    const replay = await service.execute({ ...input, requestId: "request_2" }, async () => {
      executions += 1;
      return { ok: true as const, order: { id: "order_2" } };
    });

    assert.equal(executions, 1);
    assert.deepEqual(first, {
      ok: true,
      replayed: false,
      value: { ok: true, order: { id: "order_1" } },
    });
    assert.deepEqual(replay, {
      ok: true,
      replayed: true,
      value: { ok: true, order: { id: "order_1" } },
    });
  });

  it("rejects reuse of a key with a different payload", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    const envelope = {
      actorUserId: "user_1",
      idempotencyKey: "refund-1",
      operation: "order.refund" as const,
      payload: { amount: 100, orderId: "order_1" },
      requestId: "request_1",
      resourceKeys: ["order:order_1"],
      source: "assisted_sale" as const,
      tenantId: "tenant_1",
    };

    await service.execute(envelope, async () => ({ ok: true }));
    const conflict = await service.execute(
      { ...envelope, payload: { amount: 200, orderId: "order_1" } },
      async () => ({ ok: true }),
    );

    assert.deepEqual(conflict, {
      error: "idempotency_conflict",
      ok: false,
      status: 409,
    });
  });

  it("reports an overlapping execution instead of duplicating the side effect", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const envelope = {
      actorUserId: "user_1",
      idempotencyKey: "assist-concurrent",
      operation: "assisted_sale.create" as const,
      payload: { items: [{ quantity: 1, variantId: "variant_1" }] },
      requestId: "request_1",
      resourceKeys: ["order:order_1"],
      source: "assisted_sale" as const,
      tenantId: "tenant_1",
    };
    const first = service.execute(envelope, async () => {
      await blocked;
      return { ok: true };
    });

    const overlap = await service.execute(envelope, async () => ({ ok: true }));
    release();
    await first;

    assert.deepEqual(overlap, {
      error: "mutation_in_progress",
      ok: false,
      status: 409,
    });
  });

  it("scopes the same idempotency key independently per tenant", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    const envelope = {
      actorUserId: "user_1",
      idempotencyKey: "shared-key",
      operation: "order.refund" as const,
      payload: { amount: 100, orderId: "order_1" },
      requestId: "request_1",
      resourceKeys: ["order:order_1"],
      source: "assisted_sale" as const,
      tenantId: "tenant_1",
    };

    const first = await service.execute(envelope, async () => ({ tenant: "tenant_1" }));
    const second = await service.execute({ ...envelope, tenantId: "tenant_2" }, async () => ({
      tenant: "tenant_2",
    }));

    assert.deepEqual(first, {
      ok: true,
      replayed: false,
      value: { tenant: "tenant_1" },
    });
    assert.deepEqual(second, {
      ok: true,
      replayed: false,
      value: { tenant: "tenant_2" },
    });
  });

  it("blocks blind retry after an ambiguous mutation failure", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    const envelope = {
      actorUserId: "user_1",
      idempotencyKey: "refund-ambiguous",
      operation: "order.refund" as const,
      payload: { amount: 100, orderId: "order_1" },
      requestId: "request_1",
      resourceKeys: ["order:order_1"],
      source: "assisted_sale" as const,
      tenantId: "tenant_1",
    };

    await assert.rejects(
      service.execute(envelope, async () => {
        throw new Error("response lost");
      }),
      /response lost/,
    );
    const retry = await service.execute(envelope, async () => ({ ok: true }));

    assert.deepEqual(retry, {
      error: "mutation_repair_required",
      ok: false,
      status: 409,
    });
  });

  it("rejects a different key while the same commerce resource is mutating", async () => {
    const service = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let release: (() => void) | undefined;
    const pending = service.execute(
      {
        actorUserId: "user_1",
        idempotencyKey: "refund-a",
        operation: "order.refund",
        payload: { amount: 100, orderId: "order_1" },
        requestId: "request_1",
        resourceKeys: ["order:order_1"],
        source: "assisted_sale",
        tenantId: "tenant_1",
      },
      () =>
        new Promise<{ ok: true }>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );
    await new Promise((resolve) => setImmediate(resolve));

    const overlap = await service.execute(
      {
        actorUserId: "user_1",
        idempotencyKey: "refund-b",
        operation: "order.refund",
        payload: { amount: 50, orderId: "order_1" },
        requestId: "request_2",
        resourceKeys: ["order:order_1"],
        source: "assisted_sale",
        tenantId: "tenant_1",
      },
      async () => ({ ok: true }),
    );

    assert.deepEqual(overlap, {
      error: "mutation_in_progress",
      ok: false,
      status: 409,
    });
    release?.();
    await pending;
  });
});
