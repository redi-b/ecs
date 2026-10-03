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
    const capabilities = await options.getMerchantCapabilities?.({
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });
    const setupComplete = context.req.query("setupComplete") === "true";
    const campaigns = await options.listDiscoveryCampaigns({
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
      permissions: capabilities?.permissions ?? [],
      setupComplete,
    });
    return context.json({
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        key: campaign.key,
        content: campaign.content,
        action: campaign.action,
      })),
    });
  });

  app.post("/platform/merchant/discovery/events", async (context) => {
    if (!options.recordDiscoveryEvent) return context.json({ error: "discovery_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { overview: ["read"] });
    if (!merchant.ok) return merchant.response;
    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (
      typeof body.campaignId !== "string" ||
      typeof body.event !== "string" ||
      typeof body.idempotencyKey !== "string" ||
      body.idempotencyKey.length < 8 ||
      body.idempotencyKey.length > 200
    ) {
      return context.json({ error: "invalid_discovery_event" }, 400);
    }
    try {
      await options.recordDiscoveryEvent({
        campaignId: body.campaignId,
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
        event: body.event,
        idempotencyKey: body.idempotencyKey,
        metadata:
          typeof body.metadata === "object" && body.metadata
            ? (body.metadata as Record<string, unknown>)
            : {},
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_discovery_event";
      return context.json(
        { error: code === "discovery_campaign_not_found" ? code : "invalid_discovery_event" },
        400,
      );
    }
    return context.json({ ok: true });
  });
}
