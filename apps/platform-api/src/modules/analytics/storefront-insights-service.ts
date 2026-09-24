import type {
  AnalyticsDateRange,
  AnalyticsDimension,
  StorefrontAnalyticsProvider,
  StorefrontDimensionRow,
  StorefrontTrafficPoint,
  StorefrontTrafficSummary,
} from "./providers/types.js";

export type StorefrontInsightsSnapshot = {
  dimensions: Partial<Record<AnalyticsDimension, StorefrontDimensionRow[]>>;
  range: { from: string; timezone: string; to: string };
  series: StorefrontTrafficPoint[];
  status: "available" | "unavailable";
  traffic: StorefrontTrafficSummary | null;
};

export function createStorefrontInsightsService(options: {
  logger?: { warn: (details: unknown, message: string) => void };
  provider: StorefrontAnalyticsProvider;
}) {
  return async function getStorefrontInsights(input: {
    days: number;
    hostname: string;
    name: string;
    tenantId: string;
    timezone?: string;
  }): Promise<StorefrontInsightsSnapshot> {
    const to = new Date();
    const from = new Date(to.getTime() - (Math.max(1, input.days) - 1) * 86_400_000);
    from.setUTCHours(0, 0, 0, 0);
    const timezone = input.timezone ?? "Africa/Addis_Ababa";
    const range: AnalyticsDateRange = { from, timezone, to };

    try {
      const site = await options.provider.ensureSite({
        domain: input.hostname,
        name: input.name,
        requestedId: input.tenantId,
      });
      const [traffic, series, referrer, path, country, device] = await Promise.all([
        options.provider.getTrafficSummary({ range, siteId: site.siteId }),
        options.provider.getTimeSeries({ range, siteId: site.siteId }),
        getDimension(options.provider, site.siteId, range, "referrer"),
        getDimension(options.provider, site.siteId, range, "path"),
        getDimension(options.provider, site.siteId, range, "country"),
        getDimension(options.provider, site.siteId, range, "device"),
      ]);
      return {
        dimensions: { country, device, path, referrer },
        range: { from: from.toISOString(), timezone, to: to.toISOString() },
        series,
        status: "available",
        traffic,
      };
    } catch (error) {
      options.logger?.warn(
        { error, tenantId: input.tenantId },
        "Storefront analytics provider read failed.",
      );
      return {
        dimensions: {},
        range: { from: from.toISOString(), timezone, to: to.toISOString() },
        series: [],
        status: "unavailable",
        traffic: null,
      };
    }
  };
}

function getDimension(
  provider: StorefrontAnalyticsProvider,
  siteId: string,
  range: AnalyticsDateRange,
  dimension: AnalyticsDimension,
) {
  return provider.getDimensions({ dimension, limit: 8, range, siteId });
}
