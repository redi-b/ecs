import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";
import { getPlatformAccess } from "./operator-access.js";

export function registerPlatformOperatorDiscoveryRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/operator/discovery/campaigns", async (context) => {
    if (!options.listDiscoveryCampaignCatalog)
      return context.json({ error: "discovery_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json({ campaigns: await options.listDiscoveryCampaignCatalog() });
  });

  app.post("/platform/operator/discovery/campaigns/:campaignId", async (context) => {
    if (!options.updateDiscoveryCampaign)
      return context.json({ error: "discovery_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.retry");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const reason = getRequiredBodyString(record, "reason");
    if (!reason || reason.length < 10) return context.json({ error: "reason_required" }, 400);
    const result = await options.updateDiscoveryCampaign({
      actorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      campaignId: context.req.param("campaignId"),
      reason,
      patch: (record.patch && typeof record.patch === "object" ? record.patch : {}) as {
        status?: string;
        priority?: number;
        startsAt?: Date | null;
        endsAt?: Date | null;
        cooldownHours?: number;
        snoozeDays?: number;
        maxImpressions?: number | null;
        content?: Record<string, unknown>;
        action?: Record<string, unknown>;
        targeting?: Record<string, unknown>;
      },
    });
    return result.ok ? context.json(result) : context.json(result, result.status);
  });
}
