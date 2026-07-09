import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getPaginationValue } from "../shared.js";

export function registerPlatformOnboardingRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {

  app.get("/platform/onboarding/state", async (context) => {
    if (!options.getOnboardingState) {
      return context.json({ error: "onboarding_state_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const result = await options.getOnboardingState({
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status === 401 ? 401 : 503);
    }

    return context.json(result.state);
  });

  app.get("/platform/tenants", async (context) => {
    if (!options.listTenantsForUser) {
      return context.json({ error: "tenant_list_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const result = await options.listTenantsForUser({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      userId: session.user.id,
    });

    return context.json({
      tenants: result.tenants,
      count: result.count,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.get("/platform/tenants/handle-availability", async (context) => {
    if (!options.checkTenantHandleAvailability) {
      return context.json({ error: "handle_availability_unavailable" }, 503);
    }

    const result = await options.checkTenantHandleAvailability({
      handle: context.req.query("handle") ?? "",
    });

    return context.json(result);
  });

  app.get("/platform/tenants/:tenantId", async (context) => {
    if (!options.getTenantForUser) {
      return context.json({ error: "tenant_detail_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const result = await options.getTenantForUser({
      tenantId: context.req.param("tenantId"),
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
