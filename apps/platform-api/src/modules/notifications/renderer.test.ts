import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCodeNotificationRenderer } from "./renderer.js";

describe("createCodeNotificationRenderer", () => {
  const renderer = createCodeNotificationRenderer();

  it("renders order.created with subject for email", async () => {
    const result = await renderer.render({
      channel: "email",
      eventType: "order.created",
      tenantId: "tenant-1",
      recipient: "owner@example.com",
      payload: { orderDisplayId: "#1001", amount: "ETB 1200" },
    });

    assert.equal(result.subject, "New order #1001");
    assert.match(result.body, /#1001/);
    assert.match(result.body, /ETB 1200/);
  });

  it("omits subject for telegram", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "notification.test",
      tenantId: "tenant-1",
      recipient: "12345",
      payload: {},
    });

    assert.equal(result.subject, undefined);
    assert.match(result.body, /test notification/i);
  });
});
