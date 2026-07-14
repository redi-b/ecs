import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createNotificationService } from "./service.js";

describe("createNotificationService enqueue", () => {
  it("returns empty logIds when no preferences match", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };

    const enqueued: unknown[] = [];
    const service = createNotificationService(db as never, {
      enqueueJob: async (input) => {
        enqueued.push(input);
        return {
          jobRunId: "job-1",
          name: input.name,
          status: "queued",
          reused: false,
        };
      },
    });

    const result = await service.recordNotificationEvent({
      tenantId: "tenant-1",
      eventType: "order.created",
      payload: { orderId: "o1" },
    });

    assert.deepEqual(result, { ok: true, logCount: 0, logIds: [] });
    assert.deepEqual(enqueued, []);
  });

  it("inserts logs and enqueues one job per matching preference", async () => {
    const preferences = [
      {
        id: "pref-1",
        tenantId: "tenant-1",
        channel: "email",
        enabled: true,
        target: "a@b.com",
        events: ["order.created"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "pref-2",
        tenantId: "tenant-1",
        channel: "telegram",
        enabled: true,
        target: "111",
        events: ["*"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const insertedPayloads: unknown[] = [];
    const enqueued: unknown[] = [];

    const db = {
      select: () => ({
        from: () => ({
          where: async () => preferences,
        }),
      }),
      insert: () => ({
        values: (rows: unknown[]) => {
          insertedPayloads.push(...rows);
          return {
            returning: async () => [{ id: "log-a" }, { id: "log-b" }],
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => [],
        }),
      }),
    };

    const service = createNotificationService(db as never, {
      enqueueJob: async (input) => {
        enqueued.push(input);
        return {
          jobRunId: "job",
          name: input.name,
          status: "queued",
          reused: false,
        };
      },
    });

    const result = await service.recordNotificationEvent({
      tenantId: "tenant-1",
      eventType: "order.created",
      payload: { orderDisplayId: "#9" },
    });

    assert.equal(result.logCount, 2);
    assert.deepEqual(result.logIds, ["log-a", "log-b"]);
    assert.equal(enqueued.length, 2);
    assert.deepEqual(enqueued[0], {
      name: "notifications.deliver",
      payload: { notificationLogId: "log-a" },
      tenantId: "tenant-1",
      idempotencyKey: "notifications.deliver:log-a",
    });
    assert.equal(
      (insertedPayloads[0] as { payload: unknown }).payload &&
        typeof (insertedPayloads[0] as { payload: unknown }).payload === "object",
      true,
    );
  });
});
