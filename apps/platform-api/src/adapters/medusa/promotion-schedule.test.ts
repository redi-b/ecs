import assert from "node:assert/strict";
import { test } from "node:test";
import { promotionSchedule } from "./promotion-schedule.js";

test("promotion schedule distinguishes unbounded, future, current, and expired dates", () => {
  const now = Date.parse("2026-09-07T09:00:00Z");
  assert.equal(promotionSchedule({ startsAt: null, endsAt: null }, now), "unscheduled");
  assert.equal(
    promotionSchedule({ startsAt: "2026-09-07T12:00:01+03:00", endsAt: null }, now),
    "scheduled",
  );
  assert.equal(
    promotionSchedule({ startsAt: "2026-09-07T12:00:00+03:00", endsAt: null }, now),
    "current",
  );
  assert.equal(
    promotionSchedule({ startsAt: null, endsAt: "2026-09-07T12:00:00+03:00" }, now),
    "expired",
  );
  assert.equal(promotionSchedule({ startsAt: "invalid", endsAt: null }, now), "unknown");
  assert.equal(
    promotionSchedule({ startsAt: "2026-09-08T00:00:00Z", endsAt: "2026-09-06T00:00:00Z" }, now),
    "unknown",
  );
});
