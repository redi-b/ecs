import assert from "node:assert/strict";
import test from "node:test";

import { validateSupportAccessExpiry } from "./access-service.js";

test("support access requires an expiry between 15 minutes and 8 hours", () => {
  const now = new Date("2026-08-25T10:00:00.000Z");
  assert.equal(validateSupportAccessExpiry(new Date("2026-08-25T10:14:59.999Z"), now), false);
  assert.equal(validateSupportAccessExpiry(new Date("2026-08-25T10:15:00.000Z"), now), true);
  assert.equal(validateSupportAccessExpiry(new Date("2026-08-25T18:00:00.000Z"), now), true);
  assert.equal(validateSupportAccessExpiry(new Date("2026-08-25T18:00:00.001Z"), now), false);
  assert.equal(validateSupportAccessExpiry(new Date("2026-08-25T09:00:00.000Z"), now), false);
});
