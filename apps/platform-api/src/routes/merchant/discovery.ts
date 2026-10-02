import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { MerchantRouteHelpers } from "./context.js";

export function registerMerchantDiscoveryRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/discovery", async (context) => {
    if (!options.listDiscoveryCampaigns) return context.json({ campaigns: [] });
    const merchant = await helpers.getAuthorizedMerchantContext(context, { overview: ["read"] });
    if (!merchant.ok) return merchant.response;
    const campaigns = await options.listDiscoveryCampaigns({
      tenantId: merchant.result.context.tenantId,
    });
    return context.json({ campaigns });
  });

  app.post("/platform/merchant/discovery/events", async (context) => {
    if (!options.recordDiscoveryEvent) return context.json({ error: "discovery_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { overview: ["read"] });
    if (!merchant.ok) return merchant.response;
    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.campaignId !== "string" || typeof body.event !== "string") {
      return context.json({ error: "invalid_discovery_event" }, 400);
    }
    await options.recordDiscoveryEvent({
      campaignId: body.campaignId,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
      event: body.event,
      metadata:
        typeof body.metadata === "object" && body.metadata
          ? (body.metadata as Record<string, unknown>)
          : {},
    });
    return context.json({ ok: true });
  });
}
