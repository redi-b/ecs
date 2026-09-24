import { type createPlatformDb, metricRollupCheckpoints } from "@ecs/db";
import { and, eq, sql } from "drizzle-orm";
import { COMMERCE_ROLLUP_KEY, COMMERCE_ROLLUP_VERSION } from "./commerce-rollup.js";
import type { DemandRow, ReadProductDemand } from "./insights-demand.js";
import { reportingDayStart, shiftReportingDay } from "./reporting-calendar.js";

export function createProductDemandReader(
  db: ReturnType<typeof createPlatformDb>["db"],
): ReadProductDemand {
  return ({ tenantId, query }) =>
    db.transaction(
      async (tx) => {
        const checkpoint = await tx
          .select({
            lastSuccessfulAt: metricRollupCheckpoints.lastSuccessfulAt,
            timezone: metricRollupCheckpoints.timezone,
            metadata: metricRollupCheckpoints.metadata,
          })
          .from(metricRollupCheckpoints)
          .where(
            and(
              eq(metricRollupCheckpoints.tenantId, tenantId),
              eq(metricRollupCheckpoints.rollupKey, COMMERCE_ROLLUP_KEY),
              eq(metricRollupCheckpoints.rollupVersion, COMMERCE_ROLLUP_VERSION),
            ),
          )
          .limit(1);
        const from = reportingDayStart(query.from);
        const to = reportingDayStart(shiftReportingDay(query.to, 1));
        // Resolve variants only from same-tenant sales evidence. Never resolve a legacy
        // handle from a current catalog slug: handles can be renamed or reused.
        const ctes = sql`with variant_products as (
      select variant_id, min(product_id) product_id from product_sales_daily
      where tenant_id = ${tenantId} and variant_id <> ''
      group by variant_id having count(distinct product_id) = 1
    ), events as (
      select e.event_type, e.session_id_hash, e.occurred_at, e.properties,
        case
          when e.subject_type = 'product' and e.properties->>'identityVersion' = '2'
            and e.subject_id = e.properties->>'productId' and e.subject_id <> '' then e.subject_id
          when e.subject_type = 'variant' then v.product_id
          else null end product_id,
        e.subject_type, e.subject_id
      from analytics_events e left join variant_products v
        on e.subject_type = 'variant' and v.variant_id = e.subject_id
      where e.tenant_id = ${tenantId} and e.source = 'storefront'
        and e.occurred_at >= ${from} and e.occurred_at < ${to}
        and e.event_type in ('storefront.product_viewed', 'storefront.add_to_cart_clicked')
    ), identified as (
      select *, case when product_id is not null then 'product'
        when subject_type = 'product' and coalesce(properties->>'identityVersion', '') <> '2' then 'legacy_handle'
        when subject_type = 'variant' then 'variant' else 'unknown' end identity,
        case when product_id is not null then 'product:' || product_id
          else coalesce(subject_type, 'unknown') || ':' || coalesce(subject_id, '') || ':' || coalesce(properties->>'identityVersion', 'legacy') end key
      from events
    ), interest as (
      select key, min(product_id) product_id, min(identity) identity,
        (array_agg(coalesce(nullif(properties->>'productTitle', ''), case when identity = 'legacy_handle' then subject_id end) order by occurred_at desc))[1] title,
        count(distinct session_id_hash) filter (where event_type = 'storefront.product_viewed')::int views,
        count(distinct session_id_hash) filter (where event_type = 'storefront.add_to_cart_clicked')::int cart_sessions
      from identified group by key
    ), sales as (
      select product_id,
        (array_agg(product_title order by date desc, variant_id))[1] title,
        (array_agg(thumbnail order by date desc, variant_id))[1] thumbnail,
        sum(units)::float8 units, sum(paid_units)::float8 paid_units
      from product_sales_daily where tenant_id = ${tenantId} and date >= ${query.from} and date <= ${query.to}
      group by product_id
    ), combined as (
      select coalesce(i.key, 'product:' || s.product_id) key,
        coalesce(i.product_id, s.product_id) product_id,
        coalesce(i.identity, 'product') identity, coalesce(s.title, i.title) title, s.thumbnail,
        coalesce(i.views, 0)::int views, coalesce(i.cart_sessions, 0)::int cart_sessions,
        case when coalesce(i.product_id, s.product_id) is not null then coalesce(s.units, 0) else null end units,
        case when coalesce(i.product_id, s.product_id) is not null then coalesce(s.paid_units, 0) else null end paid_units
      from interest i full join sales s on i.product_id = s.product_id
    )`;
        const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
        const filter = query.q ? sql`where coalesce(title, '') ilike ${pattern}` : sql``;
        const sort =
          query.sort === "units"
            ? sql`units desc nulls last`
            : query.sort === "cart"
              ? sql`cart_sessions desc`
              : sql`views desc`;
        const result = await tx.execute<{
          count: number;
          tracking: {
            recordedEvents: number;
            unlinkedEvents: number;
            eventsWithoutSession: number;
          };
          rows: Array<{
            key: string;
            product_id: string | null;
            identity: DemandRow["identity"];
            title: string | null;
            thumbnail: string | null;
            views: number;
            cart_sessions: number;
            units: number | null;
            paid_units: number | null;
          }>;
        }>(sql`${ctes}
      select (select count(*)::int from combined ${filter}) count,
        (select json_build_object('recordedEvents', count(*)::int,
          'unlinkedEvents', count(*) filter (where product_id is null)::int,
          'eventsWithoutSession', count(*) filter (where session_id_hash is null)::int) from events) tracking,
        coalesce((select json_agg(rows) from (
          select * from combined ${filter} order by ${sort}, key
          limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}
        ) rows), '[]'::json) rows`);
        const value = result.rows[0]!;
        return {
          checkpoint: checkpoint[0] ?? null,
          count: value.count,
          tracking: value.tracking,
          rows: value.rows.map((row) => ({
            key: row.key,
            productId: row.product_id,
            identity: row.identity,
            title: row.title,
            thumbnail: row.thumbnail,
            views: row.views,
            cartSessions: row.cart_sessions,
            units: row.units,
            paidUnits: row.paid_units,
          })),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
}
