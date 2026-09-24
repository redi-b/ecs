import type { InsightsStorefrontQuery, InsightsTraffic } from "@ecs/contracts";
import type { StorefrontAnalyticsProvider } from "./providers/types.js";
import { reportingDayStart, shiftReportingDay } from "./reporting-calendar.js";

export type ReadInsightsTraffic = (input: {
  tenantId: string;
  query: InsightsStorefrontQuery;
}) => Promise<InsightsTraffic>;

/** Provider reads never create sites; ingestion/provisioning owns that lifecycle. */
export function createInsightsTrafficReader(
  provider: StorefrontAnalyticsProvider | null,
  logger?: { warn: (details: unknown, message: string) => void },
): ReadInsightsTraffic {
  return async ({ tenantId, query }) => {
    const base = {
      dimension: query.trafficDimension,
      page: query.trafficPage,
      pageSize: query.trafficPageSize,
      count: 0,
      limited: false,
      limit: 500 as const,
      summary: null,
      rows: [],
    };
    if (!provider) return { ...base, status: "not_configured" };
    const range = {
      from: reportingDayStart(query.from),
      to: new Date(reportingDayStart(shiftReportingDay(query.to, 1)).getTime() - 1),
      timezone: "Africa/Addis_Ababa",
    };
    try {
      const [summary, dimensions] = await Promise.all([
        provider.getTrafficSummary({ siteId: tenantId, range }),
        provider.getDimensions({
          siteId: tenantId,
          range,
          dimension: query.trafficDimension,
          limit: 501,
        }),
      ]);
      // Older adapter names this field visits; /metrics returns visitor counts.
      if (
        ![
          summary.visitors,
          summary.visits,
          summary.pageViews,
          ...dimensions.map((row) => row.visits),
        ].every((n) => Number.isSafeInteger(n) && n >= 0)
      )
        throw new Error("Invalid traffic counts");
      const limited = dimensions.length > 500;
      const rows = dimensions
        .slice(0, 500)
        .map((row) => ({
          key: sanitizeDimension(row.key, query.trafficDimension),
          visitors: row.visits,
        }));
      // Redaction can collapse URLs. Do not sum distinct visitor counts for them.
      const needle = query.trafficSearch.toLocaleLowerCase("en");
      const matching = rows.filter((row) => row.key.toLocaleLowerCase("en").includes(needle));
      return {
        ...base,
        status: "available",
        limited,
        count: matching.length,
        summary: {
          visitors: summary.visitors,
          visits: summary.visits,
          pageViews: summary.pageViews,
        },
        rows: matching.slice(
          (query.trafficPage - 1) * query.trafficPageSize,
          query.trafficPage * query.trafficPageSize,
        ),
      };
    } catch (error) {
      logger?.warn({ error, tenantId }, "Insights traffic provider read failed");
      return { ...base, status: "unavailable" };
    }
  };
}

function sanitizeDimension(value: string, dimension: InsightsStorefrontQuery["trafficDimension"]) {
  if (dimension === "path")
    return value.startsWith("/") && !value.startsWith("//") ? value.split(/[?#]/, 1)[0]! : "";
  if (dimension === "referrer") {
    if (!value) return "";
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      return ["http:", "https:"].includes(url.protocol) ? url.hostname : "";
    } catch {
      return "";
    }
  }
  return value.slice(0, 200);
}
