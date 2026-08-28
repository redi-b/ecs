import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAwaitingInsightsReport,
  refreshStateFromResponse,
  restoreInsightsRefreshState,
} from "./insights-refresh-state";

describe("Insights refresh state", () => {
  it("drops an expired persisted cooldown instead of restoring a stuck request", () => {
    assert.equal(
      restoreInsightsRefreshState(
        JSON.stringify({
          requestedAt: "2026-08-26T10:00:00.000Z",
          retryAt: "2026-08-26T10:15:00.000Z",
        }),
        new Date("2026-08-26T10:15:00.000Z").getTime(),
      ),
      null,
    );
  });

  it("does not show a reused cooldown request as pending", () => {
    const state = refreshStateFromResponse({
      queued: false,
      requestedAt: "2026-08-26T10:07:00.000Z",
      retryAt: "2026-08-26T10:15:00.000Z",
    });
    assert.equal(state.requestedAt, null);
    assert.equal(
      isAwaitingInsightsReport({
        lastSuccessfulAt: "2026-08-26T10:01:00.000Z",
        nowMs: new Date("2026-08-26T10:08:00.000Z").getTime(),
        state,
      }),
      false,
    );
  });

  it("stops awaiting a newly queued report at the server cooldown boundary", () => {
    const state = refreshStateFromResponse({
      queued: true,
      requestedAt: "2026-08-26T10:07:00.000Z",
      retryAt: "2026-08-26T10:15:00.000Z",
    });
    assert.equal(
      isAwaitingInsightsReport({
        lastSuccessfulAt: "2026-08-26T10:01:00.000Z",
        nowMs: new Date("2026-08-26T10:15:00.000Z").getTime(),
        state,
      }),
      false,
    );
  });
});
