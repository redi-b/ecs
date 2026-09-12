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
      inbox: {
        materializeEvent: async (eventId: string) => {
          calls.push(eventId);
          return { alreadyProcessed: false, created: true, recipients: 2 };
        },
      } as never,
    });

    const result = await handler(context({ eventId: "event-1" }) as never);

    assert.deepEqual(calls, ["event-1"]);
    assert.deepEqual(result, { alreadyProcessed: false, created: true, recipients: 2 });
  });

  it("rejects a malformed payload without retrying", async () => {
    const handler = createInAppNotificationMaterializeHandler({ inbox: {} as never });
    await assert.rejects(() => handler(context({}) as never), {
      message: "notifications.in-app.materialize requires eventId",
    });
  });
});
