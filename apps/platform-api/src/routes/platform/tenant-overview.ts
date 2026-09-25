import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getPaginationValue } from "../shared.js";

type Dependencies = Pick<
  PlatformAppOptions,
  "authorizeDashboardForTenant" | "getSession" | "getTenantInsightsSummary" | "getTenantOnboarding"
>;

export function registerPlatformTenantOverviewRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.get("/platform/tenants/:tenantId/insights/summary", async (context) => {
    if (!options.getTenantInsightsSummary) {
      return context.json({ error: "insights_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { insights: ["read"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.getTenantInsightsSummary({
      days: getPaginationValue(context.req.query("days"), 30, 365),
      tenantId,
    });

    return context.json({
      summary: result.summary,
    });
  });

  app.get("/platform/tenants/:tenantId/onboarding", async (context) => {
    if (!options.getTenantOnboarding) {
      return context.json({ error: "onboarding_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { overview: ["read"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.getTenantOnboarding({ tenantId });

    if (!result.ok) {
      return context.json({ error: result.error }, 404);
    }

    return context.json({
      onboarding: result.onboarding,
    });
  });
}
