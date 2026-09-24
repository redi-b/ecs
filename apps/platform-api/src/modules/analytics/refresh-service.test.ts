import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInsightsRefreshService, INSIGHTS_REFRESH_COOLDOWN_MS } from "./refresh-service.js";

describe("insights refresh service", () => {
  it("creates a tenant-scoped idempotency window", async () => {
    const calls: unknown[] = [];
    const requestedAt = new Date("2026-08-26T10:07:00.000Z");
    const service = createInsightsRefreshService({
      now: () => requestedAt,
      enqueueJob: async (input) => {
        calls.push(input);
        return {
          jobRunId: "job_1",
          name: input.name,
          reused: false,
          status: "queued",
        };
      },
    });

    const result = await service({ tenantId: "tenant_1" });
    const window = Math.floor(requestedAt.getTime() / INSIGHTS_REFRESH_COOLDOWN_MS);

    assert.deepEqual(calls, [
      {
        idempotencyKey: `merchant-insights-refresh:tenant_1:${window}`,
        name: "analytics.commerce-rollup",
        payload: { source: "merchant" },
        tenantId: "tenant_1",
      },
    ]);
    assert.equal(result.queued, true);
    assert.equal(new Date(result.retryAt).getTime(), (window + 1) * INSIGHTS_REFRESH_COOLDOWN_MS);
  });

  it("reports a reused job as rate-limited without duplicate work", async () => {
    const service = createInsightsRefreshService({
      enqueueJob: async () => ({
        jobRunId: "job_existing",
        name: "analytics.commerce-rollup",
        reused: true,
        status: "active",
      }),
    });

    assert.equal((await service({ tenantId: "tenant_1" })).queued, false);
  });
});
