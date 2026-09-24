import {
  insightsStorefrontQuerySchema,
  type InsightsStorefrontQuery,
  type InsightsStorefrontReport,
} from "@ecs/contracts";
import { comparisonRange } from "./insights-sales.js";
import { reportingDay, reportingDays } from "./reporting-calendar.js";
import type { ReadInsightsTraffic } from "./insights-traffic.js";

export const STOREFRONT_STAGE_EVENTS = {
  pages: "storefront.page_viewed",
  products: "storefront.product_viewed",
  cart: "storefront.add_to_cart_clicked",
  checkout: "storefront.checkout_started",
  search: "storefront.search_submitted",
} as const;
export type StorefrontSource = {
  stages: { eventType: string; sessions: number; previousSessions: number }[];
  recordedEvents: number;
  eventsWithoutSession: number;
  count: number;
  rows: { path: string; sessions: number }[];
};
export type ReadStorefrontReport = (input: {
  tenantId: string;
  query: InsightsStorefrontQuery;
  previousRange: { from: string; to: string } | null;
}) => Promise<StorefrontSource>;

export function createInsightsStorefrontService(
  read: ReadStorefrontReport,
  now: () => Date = () => new Date(),
  readTraffic?: ReadInsightsTraffic,
) {
  return async (input: { tenantId: string; query: unknown }) => {
    const parsed = insightsStorefrontQuerySchema.safeParse(input.query);
    if (
      !parsed.success ||
      parsed.data.from < "1970-01-01" ||
      parsed.data.from > parsed.data.to ||
      parsed.data.to >= reportingDay(now()) ||
      reportingDays(parsed.data.from, parsed.data.to) > 366
    ) {
      return { ok: false as const, error: "insights_range_invalid", status: 400 as const };
    }
    const query = parsed.data;
    const previousRange = comparisonRange(query);
    const [source, traffic] = await Promise.all([
      read({ tenantId: input.tenantId, query, previousRange }),
      readTraffic?.({ tenantId: input.tenantId, query }),
    ]);
    const report: InsightsStorefrontReport = {
      tenantId: input.tenantId,
      ...(traffic ? { traffic } : {}),
      generatedAt: now().toISOString(),
      range: { from: query.from, to: query.to },
      previousRange,
      stage: query.stage,
      recordedEvents: source.recordedEvents,
      eventsWithoutSession: source.eventsWithoutSession,
      stages: Object.entries(STOREFRONT_STAGE_EVENTS).map(([key, eventType]) => {
        const item = source.stages.find((row) => row.eventType === eventType);
        return {
          key: key as InsightsStorefrontQuery["stage"],
          sessions: item?.sessions ?? 0,
          previousSessions: previousRange ? (item?.previousSessions ?? 0) : null,
        };
      }),
      count: source.count,
      page: query.page,
      pageSize: query.pageSize,
      rows: source.rows,
    };
    return { ok: true as const, report };
  };
}
