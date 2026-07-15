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
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => [{ id: "inbox-1" }],
          }),
          returning: async () => [],
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
    let selectCall = 0;

    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            selectCall += 1;
            // 1: notification_preferences, 2: notification_destinations
            if (selectCall === 1) {
              return preferences;
            }
            // Telegram multi-connect destinations empty in this unit test.
            return [];
          },
        }),
      }),
      insert: () => ({
        values: (rows: unknown) => {
          // First insert is in-app (single object); later is notification_logs array.
          if (Array.isArray(rows)) {
            insertedPayloads.push(...rows);
            return {
              onConflictDoNothing: () => ({
                returning: async () => [],
              }),
              returning: async () =>
                (rows as unknown[]).map((_, index) => ({ id: `log-${index + 1}` })),
            };
          }
          return {
            onConflictDoNothing: () => ({
              returning: async () => [{ id: "inbox-1" }],
            }),
            returning: async () => [{ id: "inbox-1" }],
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

    // Email preference matches; telegram channel on preferences is ignored (destinations table).
    assert.equal(result.logCount, 1);
    assert.deepEqual(result.logIds, ["log-1"]);
    assert.equal(enqueued.length, 1);
    assert.deepEqual(enqueued[0], {
      name: "notifications.deliver",
      payload: { notificationLogId: "log-1" },
      tenantId: "tenant-1",
      idempotencyKey: "notifications.deliver:log-1",
    });
    assert.equal(
      (insertedPayloads[0] as { payload: unknown }).payload &&
        typeof (insertedPayloads[0] as { payload: unknown }).payload === "object",
      true,
    );
  });
});
