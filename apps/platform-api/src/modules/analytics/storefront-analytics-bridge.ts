import type { StorefrontAnalyticsProvider } from "./providers/types.js";

export type StorefrontBehaviorEvent = {
  clientIp?: string | null;
  eventType: string;
  hostname: string;
  language?: string | null;
  properties?: Record<string, unknown> | null;
  referrer?: string | null;
  screen?: string | null;
  sessionId?: string | null;
  subjectId?: string | null;
  subjectType?: string | null;
  tenantId: string;
  title?: string | null;
  url: string;
  userAgent?: string | null;
};

export function createStorefrontAnalyticsBridge(options: {
  logger?: { warn: (details: unknown, message: string) => void };
  provider: StorefrontAnalyticsProvider;
}) {
  const sites = new Map<string, Promise<string>>();

  async function resolveSite(input: StorefrontBehaviorEvent) {
    const cached = sites.get(input.tenantId);
    if (cached) return cached;

    const pending = options.provider
      .ensureSite({
        domain: input.hostname,
        name: input.hostname,
        requestedId: input.tenantId,
      })
      .then((site) => site.siteId)
      .catch((error) => {
        sites.delete(input.tenantId);
        throw error;
      });
    sites.set(input.tenantId, pending);
    return pending;
  }

  return {
    capture: async (input: StorefrontBehaviorEvent) => {
      try {
        const siteId = await resolveSite(input);
        await options.provider.trackEvent({
          ...(input.clientIp ? { clientIp: input.clientIp } : {}),
          data: safeEventData(input),
          ...(input.eventType === "storefront.page_viewed"
            ? {}
            : {
                eventName: input.eventType.replace(/^storefront\./, "").replaceAll("_", "-"),
              }),
          hostname: input.hostname,
          ...(input.language ? { language: input.language } : {}),
          ...(input.referrer ? { referrer: input.referrer } : {}),
          ...(input.screen ? { screen: input.screen } : {}),
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          siteId,
          ...(input.title ? { title: input.title } : {}),
          url: input.url,
          userAgent: input.userAgent?.trim() || "ECS-Storefront-Analytics/1.0",
        });
        return { delivered: true as const };
      } catch (error) {
        options.logger?.warn(
          { error, eventType: input.eventType, tenantId: input.tenantId },
          "Storefront analytics provider delivery failed.",
        );
        return { delivered: false as const };
      }
    },
  };
}

function safeEventData(input: StorefrontBehaviorEvent) {
  const data: Record<string, boolean | number | string | null> = {};
  if (input.subjectId) data.subjectId = input.subjectId;
  if (input.subjectType) data.subjectType = input.subjectType;

  for (const [key, value] of Object.entries(input.properties ?? {})) {
    if (key === "path" || key === "customerId") continue;
    if (
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string" ||
      value === null
    ) {
      data[key] = value;
    }
  }
  return data;
}
