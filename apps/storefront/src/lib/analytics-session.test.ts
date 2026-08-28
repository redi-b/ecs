import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveStorefrontAnalyticsSession,
  STOREFRONT_SESSION_IDLE_MS,
} from "./analytics-session.js";

test("keeps an active storefront session and refreshes its activity time", () => {
  const now = 10_000;
  const session = resolveStorefrontAnalyticsSession({
    createId: () => "new",
    now,
    stored: JSON.stringify({ id: "existing", lastSeenAt: now - 1_000 }),
  });
  assert.deepEqual(session, { id: "existing", lastSeenAt: now });
});

test("rotates an expired or legacy storefront session", () => {
  const now = STOREFRONT_SESSION_IDLE_MS + 10_000;
  assert.deepEqual(
    resolveStorefrontAnalyticsSession({
      createId: () => "fresh",
      now,
      stored: JSON.stringify({ id: "expired", lastSeenAt: 1 }),
    }),
    { id: "fresh", lastSeenAt: now },
  );
  assert.equal(
    resolveStorefrontAnalyticsSession({ createId: () => "fresh", now, stored: "legacy-id" }).id,
    "fresh",
  );
});
