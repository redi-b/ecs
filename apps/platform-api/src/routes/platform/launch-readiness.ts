import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

type LaunchReadinessRouteDependencies = Pick<
  PlatformAppOptions,
  "authorizeDashboardForTenant" | "confirmStorefrontReview" | "getLaunchReadiness" | "getSession"
>;

import { getJsonBody } from "../shared.js";

export function registerLaunchReadinessRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: LaunchReadinessRouteDependencies,
) {
  app.get("/platform/tenants/:tenantId/launch-readiness", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const access = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { storefront: ["read"] },
    });
    if (!access?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    if (!options.getLaunchReadiness)
      return context.json({ error: "launch_check_unavailable" }, 503);
    const readiness = await options.getLaunchReadiness({ tenantId });
    return readiness
      ? context.json({ readiness })
      : context.json({ error: "tenant_not_found" }, 404);
  });
  app.post("/platform/tenants/:tenantId/storefront/review", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const access = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { storefront: ["edit"] },
    });
    if (!access?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const body = await getJsonBody(context.req.raw);
    if (
      body?.reviewed !== true ||
      typeof body.draftFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.draftFingerprint)
    )
      return context.json({ error: "invalid_storefront_review" }, 400);
    if (!options.confirmStorefrontReview)
      return context.json({ error: "launch_check_unavailable" }, 503);
    const confirmed = await options.confirmStorefrontReview({
      tenantId,
      userId: session.user.id,
      draftFingerprint: body.draftFingerprint,
    });
    return confirmed
      ? context.json({ ok: true })
      : context.json({ error: "storefront_review_outdated" }, 409);
  });
}
