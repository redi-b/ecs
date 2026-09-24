import { type createPlatformDb, metricRollupCheckpoints, productSalesDaily } from "@ecs/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { COMMERCE_ROLLUP_KEY, COMMERCE_ROLLUP_VERSION } from "./commerce-rollup.js";
import type { ReadProductContributions } from "./insights-products.js";

export function createProductContributionReader(
  db: ReturnType<typeof createPlatformDb>["db"],
): ReadProductContributions {
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
        const { query } = input;
        const current = sql`${productSalesDaily.date} >= ${query.from} and ${productSalesDaily.date} <= ${query.to}`;
        const earlier = input.previousRange
          ? sql`${productSalesDaily.date} >= ${input.previousRange.from} and ${productSalesDaily.date} <= ${input.previousRange.to}`
          : sql`false`;
        const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
        // Group first, then filter by the latest historical title, so a rename does not discard older sales.
        const grouped = tx
          .select({
            productId: productSalesDaily.productId,
            variantId: query.productId
              ? productSalesDaily.variantId
              : sql<string | null>`null`.as("variant_id"),
            variantTitle: sql<
              string | null
            >`(array_agg(${productSalesDaily.variantTitle} order by ${productSalesDaily.date} desc, ${productSalesDaily.variantId}))[1]`.as(
              "variant_title",
            ),
            title: sql<
              string | null
            >`(array_agg(${productSalesDaily.productTitle} order by ${productSalesDaily.date} desc, ${productSalesDaily.variantId}))[1]`.as(
              "title",
            ),
            thumbnail: sql<
              string | null
            >`(array_agg(${productSalesDaily.thumbnail} order by ${productSalesDaily.date} desc, ${productSalesDaily.variantId}))[1]`.as(
              "thumbnail",
            ),
            units:
              sql<string>`sum(case when ${current} then ${productSalesDaily.units} else 0 end)`.as(
                "units",
              ),
            paidUnits:
              sql<string>`sum(case when ${current} then ${productSalesDaily.paidUnits} else 0 end)`.as(
                "paid_units",
              ),
            previousUnits:
              sql<string>`sum(case when ${earlier} then ${productSalesDaily.units} else 0 end)`.as(
                "previous_units",
              ),
          })
          .from(productSalesDaily)
          .where(
            and(
              eq(productSalesDaily.tenantId, input.tenantId),
              query.productId ? eq(productSalesDaily.productId, query.productId) : undefined,
              gte(productSalesDaily.date, input.previousRange?.from ?? query.from),
              lte(productSalesDaily.date, query.to),
            ),
          )
          .groupBy(
            productSalesDaily.productId,
            ...(query.productId ? [productSalesDaily.variantId] : []),
          )
          .as("product_contributions");
        const filter = query.q
          ? query.productId
            ? sql`${grouped.variantTitle} ilike ${pattern}`
            : sql`${grouped.title} ilike ${pattern}`
          : undefined;
        const counts = await tx
          .select({ count: sql<string>`count(*)` })
          .from(grouped)
          .where(filter);
        const rows = await tx
          .select()
          .from(grouped)
          .where(filter)
          .orderBy(
            query.sort === "change"
              ? sql`abs(${grouped.units} - ${grouped.previousUnits}) desc`
              : sql`${grouped.units} desc`,
            grouped.productId,
            grouped.variantId,
          )
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize);
        return {
          checkpoint: checkpoints[0] ?? null,
          count: Number(counts[0]?.count ?? 0),
          rows: rows.map((row) => ({
            ...row,
            units: Number(row.units),
            paidUnits: Number(row.paidUnits),
            previousUnits: Number(row.previousUnits),
          })),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
}
