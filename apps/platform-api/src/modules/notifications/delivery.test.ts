import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NotificationProvider } from "./providers/types.js";
import { createProviderRegistry } from "./providers/registry.js";
import { createCodeNotificationRenderer } from "./renderer.js";
import { deliverNotificationLog } from "./delivery.js";

describe("deliverNotificationLog", () => {
  it("no-ops when log is already sent", async () => {
    const calls: string[] = [];
    const provider: NotificationProvider = {
      channel: "email",
      async send() {
        calls.push("send");
        return { providerReference: "should-not-run" };
      },
    };

    const sentLog = {
      id: "log-1",
      tenantId: "tenant-1",
      eventType: "order.created",
      channel: "email",
      recipient: "a@b.com",
      status: "sent" as const,
      payload: {},
      providerReference: "prev",
      error: null,
      createdAt: new Date(),
      sentAt: new Date(),
    };

    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [sentLog],
          }),
        }),
      }),
      update: () => {
        throw new Error("should not update");
      },
    };

    const result = await deliverNotificationLog({
      db: db as never,
      notificationLogId: "log-1",
      renderer: createCodeNotificationRenderer(),
      providers: createProviderRegistry([provider]),
    });

    assert.deepEqual(result, {
      ok: true,
      status: "already_sent",
      providerReference: "prev",
    });
    assert.deepEqual(calls, []);
  });

  it("sends and marks sent via provider", async () => {
    const pendingLog = {
      id: "log-2",
      tenantId: "tenant-1",
      eventType: "notification.test",
      channel: "telegram",
      recipient: "chat-99",
      status: "pending" as const,
      payload: { shopName: "Demo" },
      providerReference: null,
      error: null,
      createdAt: new Date(),
      sentAt: null,
    };

    const updates: Array<Record<string, unknown>> = [];

    const provider: NotificationProvider = {
      channel: "telegram",
      async send(input) {
        assert.equal(input.recipient, "chat-99");
        assert.match(input.body, /Demo|test/i);
        return { providerReference: "tg:1" };
      },
    };

    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [pendingLog],
          }),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push(values);
            return [];
          },
        }),
      }),
    };

    const result = await deliverNotificationLog({
      db: db as never,
      notificationLogId: "log-2",
      renderer: createCodeNotificationRenderer(),
      providers: createProviderRegistry([provider]),
    });

    assert.deepEqual(result, {
      ok: true,
      status: "sent",
      providerReference: "tg:1",
    });
    assert.equal(updates.length, 1);
    assert.equal(updates[0]?.status, "sent");
    assert.equal(updates[0]?.providerReference, "tg:1");
  });
});
