import type { Hono } from "hono";
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

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");
    const templateId = getOptionalBodyString(body, "templateId");
    const templateKey = getOptionalBodyString(body, "templateKey");

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
        redirectTo: `http://${result.tenant.primaryDomain.hostname}/admin`,
        tenant: result.tenant,
      },
      201,
    );
  });
}
