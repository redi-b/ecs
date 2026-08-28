import assert from "node:assert/strict";
import test from "node:test";

import { buildSuperadminDiagnostics, classifyOperationalFailure } from "./diagnostics-service.js";

test("classifies operational failures without returning raw messages", () => {
  assert.equal(classifyOperationalFailure("request timed out for secret-token"), "timeout");
  assert.equal(classifyOperationalFailure("HTTP 429: slow down"), "rate_limit");
  assert.equal(classifyOperationalFailure("unrecognized provider failure"), "unknown");
});

test("projects diagnostics without tenant secrets, destinations, object keys, or raw errors", () => {
  const secret = "never-return-this-secret";
  const diagnostics = buildSuperadminDiagnostics({
    jobs: [
      {
        name: "billing.invoice.renew",
        error: `timeout while using ${secret}`,
        attempts: 3,
        maxAttempts: 3,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        finishedAt: new Date("2026-08-25T10:01:00.000Z"),
      },
    ],
    notifications: [
      {
        channel: "telegram",
        eventType: "billing.invoice_due",
        error: `recipient +251911000000 rejected ${secret}`,
        createdAt: new Date("2026-08-25T10:02:00.000Z"),
      },
    ],
    mediaCounts: [{ status: "failed", total: 1 }],
    recentMediaFailures: [{ createdAt: new Date("2026-08-25T10:03:00.000Z") }],
  });

  const serialized = JSON.stringify(diagnostics);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("+251911000000"), false);
  assert.equal(serialized.includes("objectKey"), false);
  assert.equal(serialized.includes("publicUrl"), false);
  assert.deepEqual(diagnostics.jobs.recentFailures[0]?.category, "billing");
  assert.deepEqual(diagnostics.jobs.recentFailures[0]?.failureCategory, "timeout");
});
