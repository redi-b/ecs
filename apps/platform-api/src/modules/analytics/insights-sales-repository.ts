import { type createPlatformDb, dailyMetrics, metricRollupCheckpoints } from "@ecs/db";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { COMMERCE_ROLLUP_KEY, COMMERCE_ROLLUP_VERSION } from "./commerce-rollup.js";
import type { ReadSalesSource } from "./insights-sales.js";

export function createSalesSourceReader(
  db: ReturnType<typeof createPlatformDb>["db"],
): ReadSalesSource {
  return (input) =>
    db.transaction(
      async (tx) => {
        const checkpoints = await tx
          .select({
            lastSuccessfulAt: metricRollupCheckpoints.lastSuccessfulAt,
            timezone: metricRollupCheckpoints.timezone,
            metadata: metricRollupCheckpoints.metadata,
          })
          .from(metricRollupCheckpoints)
          .where(
            and(
              eq(metricRollupCheckpoints.tenantId, input.tenantId),
              eq(metricRollupCheckpoints.rollupKey, COMMERCE_ROLLUP_KEY),
              eq(metricRollupCheckpoints.rollupVersion, COMMERCE_ROLLUP_VERSION),
            ),
          )
          .limit(1);
        const rows = await tx
          .select({
            date: dailyMetrics.date,
            metricKey: dailyMetrics.metricKey,
            value: dailyMetrics.value,
          })
          .from(dailyMetrics)
          .where(
            and(
              eq(dailyMetrics.tenantId, input.tenantId),
              gte(dailyMetrics.date, input.from),
              lte(dailyMetrics.date, input.to),
              inArray(dailyMetrics.metricKey, ["overview.orders", "overview.revenue"]),
              eq(dailyMetrics.dimensionKey, ""),
              eq(dailyMetrics.dimensionValue, ""),
              eq(dailyMetrics.timezone, "Africa/Addis_Ababa"),
              eq(dailyMetrics.rollupVersion, COMMERCE_ROLLUP_VERSION),
              or(
                and(
                  eq(dailyMetrics.metricKey, "overview.orders"),
                  eq(dailyMetrics.currencyCode, ""),
                ),
                and(
                  eq(dailyMetrics.metricKey, "overview.revenue"),
                  eq(dailyMetrics.currencyCode, "ETB"),
                ),
              ),
            ),
          );
        return { checkpoint: checkpoints[0] ?? null, rows };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
}
