import type { Hono } from "hono";
import { shopDetailsSchema } from "@ecs/contracts";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getOptionalBodyString, getRequiredBodyString } from "../shared.js";

export function registerPlatformTenantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.post("/platform/tenants", async (context) => {
    if (!options.createTenantShop) {
      return context.json({ error: "tenant_provisioning_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      console.warn("[platform/tenants] create rejected: auth_required");
      return context.json({ error: "auth_required" }, 401);
    }

    const membership = await options.getTenantMembershipSummary?.({ userId: session.user.id });
    if (membership && membership.ownedCount > 0) {
      return context.json({ error: "shop_owner_limit_reached" }, 409);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");
    const templateId = getOptionalBodyString(body, "templateId");
    const templateKey = getOptionalBodyString(body, "templateKey");
    const details = body?.shopDetails === undefined ? null : shopDetailsSchema.safeParse(body.shopDetails);
    if (details && !details.success) {
      return context.json({ error: "invalid_shop_details", issues: details.error.issues }, 400);
    }

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    if (!handle) {
      return context.json({ error: "missing_handle" }, 400);
    }

    console.info("[platform/tenants] create start", {
      handle,
      ownerUserId: session.user.id,
      templateKey: templateKey ?? null,
      templateId: templateId ?? null,
    });

    const result = await options.createTenantShop({
      handle,
      name,
      ownerUserId: session.user.id,
      ...(details?.success ? { shopDetails: details.data } : {}),
      ...(templateId ? { templateId } : {}),
      ...(templateKey ? { templateKey } : {}),
    });

    if (!result.ok) {
      console.error("[platform/tenants] create failed", {
        error: result.error,
        handle,
        status: result.status,
      });
      return context.json({ error: result.error }, result.status);
    }

    console.info("[platform/tenants] create ok", {
      handle,
      tenantId: result.tenant.id,
    });

    return context.json(
      {
        redirectTo: `http://${result.tenant.primaryDomain.hostname}/dashboard`,
        tenant: result.tenant,
      },
      201,
    );
  });
}
