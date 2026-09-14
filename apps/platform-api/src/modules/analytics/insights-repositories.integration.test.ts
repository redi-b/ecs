import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformDb } from "@ecs/db";
import { createProductContributionReader } from "./insights-products-repository.js";
import { createSalesSourceReader } from "./insights-sales-repository.js";
import { createStorefrontReportReader } from "./insights-storefront-repository.js";
import { createProductDemandReader } from "./insights-demand-repository.js";

// Opt-in read-only smoke test against an already migrated PostgreSQL database.
// No migrations, fixture writes, customer data output, or transaction side effects.
test(
  "reporting repositories execute real PostgreSQL queries with tenant isolation",
  {
    skip: !process.env.INSIGHTS_TEST_DATABASE_URL,
  },
  async () => {
    const { db, pool } = createPlatformDb({
      connectionString: process.env.INSIGHTS_TEST_DATABASE_URL!,
      max: 1,
    });
    const tenantId = "00000000-0000-4000-8000-000000000000";
    const query = {
      from: "2026-09-01",
      to: "2026-09-13",
      comparison: "previous" as const,
      page: 1,
      pageSize: 20,
      q: "",
      sort: "units" as const,
      trafficDimension: "referrer" as const,
      trafficPage: 1,
      trafficPageSize: 20,
      trafficSearch: "",
    };
    const previousRange = { from: "2026-08-19", to: "2026-08-31" };
    try {
      const sales = await createSalesSourceReader(db)({
        tenantId,
        from: previousRange.from,
        to: query.to,
      });
      assert.equal(sales.checkpoint, null);
      assert.deepEqual(sales.rows, []);
      const emptyDemand = await createProductDemandReader(db)({
        tenantId,
        query: { ...query, sort: "views" },
      });
      assert.equal(emptyDemand.count, 0);
      assert.equal(emptyDemand.tracking.recordedEvents, 0);
      assert.deepEqual(emptyDemand.rows, []);
      for (const extra of [{}, { productId: "nonexistent", q: "%_\\", sort: "change" as const }]) {
        const products = await createProductContributionReader(db)({
          tenantId,
          query: { ...query, ...extra },
          previousRange,
        });
        assert.equal(products.count, 0);
        assert.deepEqual(products.rows, []);
      }
      for (const q of ["", "%_\\"]) {
        const storefront = await createStorefrontReportReader(db)({
          tenantId,
          query: { ...query, stage: "products", q },
          previousRange,
        });
        assert.equal(storefront.count, 0);
        assert.equal(storefront.recordedEvents, 0);
        assert.deepEqual(storefront.rows, []);
      }
      const sample = await pool.query<{ tenant_id: string }>(
        "select tenant_id from product_sales_daily union select tenant_id from analytics_events limit 3",
      );
      for (const { tenant_id: tenantId } of sample.rows) {
        for (const sort of ["views", "cart", "units"] as const) {
          const demand = await createProductDemandReader(db)({
            tenantId,
            query: { ...query, sort },
          });
          assert.ok(demand.count >= demand.rows.length);
          assert.ok(demand.tracking.unlinkedEvents <= demand.tracking.recordedEvents);
          for (const row of demand.rows) {
            assert.ok(Number.isInteger(row.views) && row.views >= 0);
            if (!row.productId) assert.equal(row.units, null);
          }
        }
        const products = await createProductContributionReader(db)({
          tenantId,
          query,
          previousRange,
        });
        assert.ok(products.count >= products.rows.length);
        for (const row of products.rows) {
          assert.ok(Number.isFinite(row.units) && row.units >= 0);
          assert.ok(Number.isFinite(row.paidUnits) && row.paidUnits <= row.units);
        }
        if (products.rows[0]) {
          const variants = await createProductContributionReader(db)({
            tenantId,
            query: { ...query, productId: products.rows[0].productId },
            previousRange,
          });
          assert.ok(variants.rows.every((row) => row.productId === products.rows[0]!.productId));
        }
        const storefront = await createStorefrontReportReader(db)({
          tenantId,
          query: { ...query, stage: "products" },
          previousRange,
        });
        assert.ok(storefront.count >= storefront.rows.length);
        assert.ok(storefront.eventsWithoutSession <= storefront.recordedEvents);
        assert.ok(
          storefront.stages.every((row) => Number.isInteger(row.sessions) && row.sessions >= 0),
        );
      }
    } finally {
      await pool.end();
    }
  },
);
