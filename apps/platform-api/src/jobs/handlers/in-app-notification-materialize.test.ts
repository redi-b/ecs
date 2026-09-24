import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInAppNotificationMaterializeHandler } from "./in-app-notification-materialize.js";

function context(payload: unknown) {
  return {
    attempt: 1,
    jobRunId: "run-1",
    name: "notifications.in-app.materialize",
    payload,
    signal: new AbortController().signal,
    tenantId: "tenant-1",
  };
}

describe("notifications.in-app.materialize", () => {
  it("materializes a stored inbox event", async () => {
    const calls: string[] = [];
    const handler = createInAppNotificationMaterializeHandler({
      dispatchCustomerEmail: async (eventId) => {
        calls.push(`email:${eventId}`);
        return { queued: true };
      },
      inbox: {
        materializeEvent: async (eventId: string) => {
          calls.push(eventId);
          return { alreadyProcessed: false, created: true, recipients: 2 };
        },
      } as never,
    });

    const result = await handler(context({ eventId: "event-1" }) as never);

    assert.deepEqual(calls, ["event-1", "email:event-1"]);
    assert.deepEqual(result, {
      customerEmail: { queued: true },
      inbox: { alreadyProcessed: false, created: true, recipients: 2 },
    });
  });

  it("rejects a malformed payload without retrying", async () => {
    const handler = createInAppNotificationMaterializeHandler({ inbox: {} as never });
    await assert.rejects(() => handler(context({}) as never), {
      message: "notifications.in-app.materialize requires eventId",
    });
  });

  it("retries customer delivery even when inbox materialization already completed", async () => {
    let deliveryAttempts = 0;
    const handler = createInAppNotificationMaterializeHandler({
      dispatchCustomerEmail: async () => {
        deliveryAttempts += 1;
        if (deliveryAttempts === 1) throw new Error("email_intent_temporarily_unavailable");
        return { queued: true };
      },
      inbox: {
        materializeEvent: async () => ({ alreadyProcessed: true }),
      } as never,
    });

    await assert.rejects(() => handler(context({ eventId: "event-1" }) as never), {
      message: "email_intent_temporarily_unavailable",
    });
    const result = await handler(context({ eventId: "event-1" }) as never);
    assert.equal(deliveryAttempts, 2);
    assert.deepEqual(result, {
      customerEmail: { queued: true },
      inbox: { alreadyProcessed: true },
    });
  });
});
