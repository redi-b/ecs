import type { Context, Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { MerchantRouteHelpers } from "./context.js";

/** One authorization/cache boundary for every reporting dataset. */
export function registerInsightsRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const reports = {
    sales: options.getInsightsSales,
    products: options.getInsightsProducts,
    demand: options.getInsightsDemand,
    storefront: options.getInsightsStorefront,
  };
  for (const [name, read] of Object.entries(reports)) {
    async function respond(
      context: Context<{ Variables: PlatformAppVariables }>,
      tenantId: string,
    ) {
      context.header("Cache-Control", "private, no-store");
      if (!read) return context.json({ error: "insights_unavailable" }, 503);
      const result = await read({ tenantId, query: context.req.query() });
      return result.ok
        ? context.json(result.report)
        : context.json({ error: result.error }, result.status);
    }
    app.get(`/platform/merchant/insights/${name}`, async (context) => {
      context.header("Cache-Control", "private, no-store");
      const merchant = await helpers.getAuthorizedMerchantContext(context, { insights: ["read"] });
      return merchant.ok ? respond(context, merchant.result.context.tenantId) : merchant.response;
    });
    app.get(`/platform/tenants/:tenantId/insights/${name}`, async (context) => {
      context.header("Cache-Control", "private, no-store");
      const session = await options.getSession?.(context.req.raw.headers);
      if (!session) return context.json({ error: "auth_required" }, 401);
      const tenantId = context.req.param("tenantId");
      const authorization = await options.authorizeDashboardForTenant?.({
        tenantId,
        userId: session.user.id,
        permission: { insights: ["read"] },
      });
      if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
      return respond(context, tenantId);
    });
  }
}
