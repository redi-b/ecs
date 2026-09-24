import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import {
  createAnalyticsInsightsService,
  createAnalyticsService,
  createDrizzleAnalyticsEventStore,
  createDrizzleAnalyticsInsightsStore,
} from "../modules/analytics/analytics-service.js";
import { createDashboardMetricsService } from "../modules/analytics/dashboard-metrics-service.js";
import {
  createStorefrontAnalyticsBridge,
  createStorefrontInsightsService,
  createUmamiAnalyticsProvider,
} from "../modules/analytics/index.js";
import { createInsightsDemandService } from "../modules/analytics/insights-demand.js";
import { createProductDemandReader } from "../modules/analytics/insights-demand-repository.js";
import { createInsightsProductsService } from "../modules/analytics/insights-products.js";
import { createProductContributionReader } from "../modules/analytics/insights-products-repository.js";
import { createInsightsSalesService } from "../modules/analytics/insights-sales.js";
import { createSalesSourceReader } from "../modules/analytics/insights-sales-repository.js";
import { createInsightsStorefrontService } from "../modules/analytics/insights-storefront.js";
import { createStorefrontReportReader } from "../modules/analytics/insights-storefront-repository.js";
import { createInsightsTrafficReader } from "../modules/analytics/insights-traffic.js";

type AnalyticsBootstrapOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createLogger>;
};

export function createAnalyticsRuntime(options: AnalyticsBootstrapOptions) {
  const localDefaults =
    options.env.NODE_ENV === "development"
      ? { baseUrl: "http://localhost:3003", password: "umami", username: "admin" }
      : null;
  const baseUrl = options.env.UMAMI_BASE_URL?.trim() || localDefaults?.baseUrl;
  const username = options.env.UMAMI_USERNAME?.trim() || localDefaults?.username;
  const password = options.env.UMAMI_PASSWORD?.trim() || localDefaults?.password;
  const hasAnyProviderConfig = Boolean(baseUrl || username || password);
  const providerConfigured = Boolean(baseUrl && username && password);

  if (hasAnyProviderConfig && !providerConfigured) {
    options.logger.warn(
      "Umami analytics is only partially configured; storefront behavior delivery is disabled.",
    );
  }

  const provider = providerConfigured
    ? createUmamiAnalyticsProvider({
        baseUrl: baseUrl as string,
        password: password as string,
        username: username as string,
      })
    : null;
  const storefrontAnalyticsBridge = provider
    ? createStorefrontAnalyticsBridge({ logger: options.logger, provider })
    : null;

  if (storefrontAnalyticsBridge) {
    options.logger.info("Umami storefront analytics delivery configured.");
  }

  return {
    analyticsInsightsService: createAnalyticsInsightsService(
      createDrizzleAnalyticsInsightsStore(options.db),
    ),
    analyticsService: createAnalyticsService(createDrizzleAnalyticsEventStore(options.db)),
    dashboardMetricsService: createDashboardMetricsService(options.db),
    getInsightsDemand: createInsightsDemandService(createProductDemandReader(options.db)),
    getInsightsProducts: createInsightsProductsService(createProductContributionReader(options.db)),
    getInsightsSales: createInsightsSalesService(createSalesSourceReader(options.db)),
    getInsightsStorefront: createInsightsStorefrontService(
      createStorefrontReportReader(options.db),
      undefined,
      createInsightsTrafficReader(provider, options.logger),
    ),
    getStorefrontInsights: provider
      ? createStorefrontInsightsService({ logger: options.logger, provider })
      : null,
    storefrontAnalyticsBridge,
  };
}
