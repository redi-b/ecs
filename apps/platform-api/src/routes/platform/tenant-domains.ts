import type { Hono } from "hono";
import { z } from "zod";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";

type Dependencies = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "createTenantDomain"
  | "getSession"
  | "listTenantDomains"
  | "removeTenantDomain"
  | "setTenantPrimaryDomain"
  | "verifyTenantDomainOwnership"
>;

export function registerPlatformTenantDomainRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.delete("/platform/tenants/:tenantId/domains/:domainId", async (context) => {
    if (!options.removeTenantDomain) return context.json({ error: "domains_unavailable" }, 503);
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { domains: ["manage"] },
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const domainId = context.req.param("domainId");
    if (
      !z.string().uuid().safeParse(domainId).success ||
      !z.string().uuid().safeParse(tenantId).success
    )
      return context.json({ error: "domain_invalid" }, 400);
    const result = await options.removeTenantDomain({
      domainId,
      tenantId,
      userId: session.user.id,
    });
    context.header("Cache-Control", "private, no-store");
    if (!result.ok) {
      if (result.status === 503) context.header("Retry-After", "5");
      return context.json({ error: result.error }, result.status);
    }
    return context.json({ status: result.status }, result.status === "removing" ? 202 : 200);
  });
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
      ...(result.setup ? { setup: result.setup } : {}),
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
    if (!result.ok && result.status === 503) context.header("Retry-After", "5");
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
