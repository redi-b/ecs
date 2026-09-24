export type AnalyticsDateRange = {
  from: Date;
  timezone: string;
  to: Date;
};

export type AnalyticsDimension = "browser" | "country" | "device" | "path" | "referrer";

export type StorefrontTrafficSummary = {
  bounceRate: number | null;
  pageViews: number;
  visitDurationSeconds: number | null;
  visitors: number;
  visits: number;
};

export type StorefrontTrafficPoint = {
  date: string;
  pageViews: number;
  visits: number;
};

export type StorefrontDimensionRow = {
  key: string;
  visits: number;
};

export type StorefrontAnalyticsProvider = {
  ensureSite(input: {
    domain: string;
    name: string;
    requestedId?: string;
  }): Promise<{ siteId: string }>;
  getDimensions(input: {
    dimension: AnalyticsDimension;
    limit: number;
    range: AnalyticsDateRange;
    siteId: string;
  }): Promise<StorefrontDimensionRow[]>;
  getTimeSeries(input: {
    range: AnalyticsDateRange;
    siteId: string;
  }): Promise<StorefrontTrafficPoint[]>;
  getTrafficSummary(input: {
    range: AnalyticsDateRange;
    siteId: string;
  }): Promise<StorefrontTrafficSummary>;
  provisionSite(input: {
    domain: string;
    name: string;
    requestedId?: string;
  }): Promise<{ siteId: string }>;
  trackEvent(input: {
    clientIp?: string;
    data?: Record<string, boolean | number | string | null>;
    eventName?: string;
    hostname: string;
    language?: string;
    referrer?: string;
    screen?: string;
    sessionId?: string;
    siteId: string;
    title?: string;
    url: string;
    userAgent: string;
  }): Promise<void>;
};

export class AnalyticsProviderError extends Error {
  readonly code:
    | "analytics_provider_auth_failed"
    | "analytics_provider_invalid_response"
    | "analytics_provider_request_failed"
    | "analytics_provider_unavailable";
  readonly status: number | null;

  constructor(
    code: AnalyticsProviderError["code"],
    options: { cause?: unknown; status?: number | null } = {},
  ) {
    super(code, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AnalyticsProviderError";
    this.code = code;
    this.status = options.status ?? null;
  }
}
