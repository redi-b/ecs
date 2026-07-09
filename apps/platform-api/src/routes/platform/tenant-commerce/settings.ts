import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../../app.js";
import {
  getJsonBody,
  getRequiredBodyString,
} from "../../shared.js";

export function registerPlatformTenantSettingsRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/tenants/:tenantId/dashboard", async (context) => {
    if (!options.getTenantDashboardSummary) {
      return context.json({ error: "dashboard_summary_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.getTenantDashboardSummary({ tenantId });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      ...result.summary,
      actor: authorization.actor,
    });
  });

  app.post("/platform/tenants/:tenantId/settings", async (context) => {
    if (!options.updateTenantShopSettings) {
      return context.json({ error: "settings_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    if (!handle) {
      return context.json({ error: "missing_handle" }, 400);
    }

    const result = await options.updateTenantShopSettings({
      handle,
      name,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
    });
  });


}
