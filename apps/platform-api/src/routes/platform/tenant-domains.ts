import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";

type Dependencies = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "createTenantDomain"
  | "getSession"
  | "listTenantDomains"
  | "setTenantPrimaryDomain"
  | "verifyTenantDomainOwnership"
>;

export function registerPlatformTenantDomainRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.get("/platform/tenants/:tenantId/domains", async (context) => {
    if (!options.listTenantDomains) {
      return context.json({ error: "domains_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { domains: ["manage"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.listTenantDomains({ tenantId });

    return context.json({
      domains: result.domains,
    });
  });

  app.post("/platform/tenants/:tenantId/domains", async (context) => {
    if (!options.createTenantDomain) {
      return context.json({ error: "domains_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { domains: ["manage"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const hostname = getRequiredBodyString(body, "hostname");

    if (!hostname) {
      return context.json({ error: "missing_hostname" }, 400);
    }

    const result = await options.createTenantDomain({
      hostname,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json(
      {
        domain: result.domain,
      },
      201,
    );
  });

  app.post("/platform/tenants/:tenantId/domains/:domainId/verify", async (context) => {
    if (!options.verifyTenantDomainOwnership) {
      return context.json({ error: "domain_verification_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { domains: ["manage"] },
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);

    const result = await options.verifyTenantDomainOwnership({
      domainId: context.req.param("domainId"),
      tenantId,
      userId: session.user.id,
    });
    return result.ok
      ? context.json({ domain: result.domain })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/tenants/:tenantId/domains/:domainId/primary", async (context) => {
    if (!options.setTenantPrimaryDomain) {
      return context.json({ error: "domains_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { domains: ["manage"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.setTenantPrimaryDomain({
      domainId: context.req.param("domainId"),
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      domain: result.domain,
    });
  });
}
