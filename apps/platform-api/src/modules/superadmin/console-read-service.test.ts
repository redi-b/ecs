import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildJobTypeHealth,
  buildNotificationChannelHealth,
  normalizeAuditOutcome,
} from "./console-read-service.js";

describe("superadmin audit evidence", () => {
  it("does not present an unknown stored value as a successful outcome", () => {
    assert.equal(normalizeAuditOutcome("accepted"), "accepted");
    assert.equal(normalizeAuditOutcome("failed"), "failed");
    assert.equal(normalizeAuditOutcome("unexpected"), "unknown");
  });
});

describe("superadmin health evidence", () => {
  it("groups current work, recent failures, and latest completion by job type", () => {
    const completedAt = new Date("2026-08-27T09:00:00.000Z");
    assert.deepEqual(
      buildJobTypeHealth(
        [
          { name: "analytics.commerce-rollup", status: "queued", count: 2, lastFinishedAt: null },
          {
            name: "analytics.commerce-rollup",
            status: "completed",
            count: 8,
            lastFinishedAt: completedAt,
          },
        ],
        [{ name: "analytics.commerce-rollup", count: 1 }],
      ),
      [
        {
          name: "analytics.commerce-rollup",
          queued: 2,
          active: 0,
          failedLast24Hours: 1,
          lastCompletedAt: completedAt.toISOString(),
        },
      ],
    );
  });

  it("groups delivery backlog and evidence without recipient data", () => {
    const sentAt = new Date("2026-08-27T10:00:00.000Z");
    assert.deepEqual(
      buildNotificationChannelHealth(
        [
          { channel: "telegram", status: "retrying", count: 3, lastSentAt: null },
          { channel: "telegram", status: "sent", count: 5, lastSentAt: sentAt },
        ],
        [{ channel: "telegram", count: 2 }],
      ),
      [
        {
          channel: "telegram",
          pending: 0,
          retrying: 3,
          failedLast24Hours: 2,
          lastSentAt: sentAt.toISOString(),
        },
      ],
    );
  });
});
