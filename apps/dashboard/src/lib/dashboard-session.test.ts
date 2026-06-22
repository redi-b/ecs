import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDashboardSession,
  type DashboardSession,
  verifyDashboardSession,
} from "./dashboard-session.js";

describe("dashboard session", () => {
  it("creates and verifies a signed session cookie", () => {
    const session = createDashboardSession({
      email: " Owner@Abebe.Local ",
      now: new Date("2026-06-22T12:00:00.000Z"),
      secret: "session-secret",
    });

    assert.deepEqual(
      verifyDashboardSession({
        cookieValue: session,
        now: new Date("2026-06-22T12:05:00.000Z"),
        secret: "session-secret",
      }),
      {
        email: "owner@abebe.local",
        issuedAt: "2026-06-22T12:00:00.000Z",
      } satisfies DashboardSession,
    );
  });

  it("rejects tampered sessions", () => {
    const session = createDashboardSession({
      email: "owner@abebe.local",
      now: new Date("2026-06-22T12:00:00.000Z"),
      secret: "session-secret",
    });
    const [payload, signature] = session.split(".");

    assert.ok(payload);
    assert.ok(signature);

    const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;

    assert.equal(
      verifyDashboardSession({
        cookieValue: `${tamperedPayload}.${signature}`,
        now: new Date("2026-06-22T12:05:00.000Z"),
        secret: "session-secret",
      }),
      null,
    );
  });

  it("rejects expired sessions", () => {
    const session = createDashboardSession({
      email: "owner@abebe.local",
      now: new Date("2026-06-22T12:00:00.000Z"),
      secret: "session-secret",
    });

    assert.equal(
      verifyDashboardSession({
        cookieValue: session,
        maxAgeSeconds: 60,
        now: new Date("2026-06-22T12:02:00.000Z"),
        secret: "session-secret",
      }),
      null,
    );
  });
});
