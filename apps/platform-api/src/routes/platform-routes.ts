import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getRequestHost,
  getRequiredBodyString,
  storeErrorStatus,
  templateSelectionErrorStatus,
} from "./shared.js";

export function registerPlatformRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  if (options.authHandler) {
    const authHandler = options.authHandler;

    app.on(["GET", "POST"], "/platform/auth/*", (context) => authHandler(context.req.raw));
  }

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );

  app.get("/platform/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );

  app.get("/platform/me", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    return context.json({
      user: session.user,
    });
  });

  app.post("/platform/tenants", async (context) => {
    if (!options.createTenantShop) {
      return context.json({ error: "tenant_provisioning_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
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

    const result = await options.createTenantShop({
      handle,
      name,
      ownerUserId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json(
      {
        tenant: result.tenant,
      },
      201,
    );
  });

  app.get("/platform/storefront/templates", async (context) => {
    if (!options.listStorefrontTemplates) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
    }

    const templates = await options.listStorefrontTemplates();

    return context.json({
      templates,
    });
  });

  app.get("/platform/storefront/config", async (context) => {
    if (!options.getPublishedStorefrontConfig) {
      return context.json({ error: "storefront_config_unavailable" }, 503);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const config = await options.getPublishedStorefrontConfig({
      tenantId: result.context.tenantId,
      publishedRevisionId: result.context.publishedRevisionId,
    });

    if (!config.ok) {
      return context.json({ error: config.error }, 404);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        status: result.context.status,
        domain: {
          id: result.context.domainId,
          hostname: result.context.hostname,
        },
      },
      storefront: config.config,
    });
  });

  app.post("/platform/tenants/:tenantId/storefront/template/select", async (context) => {
    if (!options.selectStorefrontTemplate) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
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

    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_request" }, 400);
    }

    const templateKey =
      typeof body === "object" && body !== null && "templateKey" in body ? body.templateKey : null;

    if (typeof templateKey !== "string" || !templateKey.trim()) {
      return context.json({ error: "missing_template_key" }, 400);
    }

    const result = await options.selectStorefrontTemplate({
      tenantId,
      templateKey: templateKey.trim(),
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, templateSelectionErrorStatus[result.error]);
    }

    return context.json({
      draft: result.draft,
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

  app.get("/platform/tenants/:tenantId/payments", async (context) => {
    if (!options.listPaymentOnboarding) {
      return context.json({ error: "payments_unavailable" }, 503);
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

    const result = await options.listPaymentOnboarding({ tenantId });

    return context.json({
      paymentOnboarding: result.paymentOnboarding,
    });
  });

  app.post("/platform/tenants/:tenantId/payments/onboarding", async (context) => {
    if (!options.submitPaymentOnboarding) {
      return context.json({ error: "payments_unavailable" }, 503);
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
    const provider = getRequiredBodyString(body, "provider");

    if (!provider) {
      return context.json({ error: "missing_provider" }, 400);
    }

    const requiredDocuments =
      typeof body === "object" &&
      body !== null &&
      "requiredDocuments" in body &&
      Array.isArray(body.requiredDocuments)
        ? body.requiredDocuments
        : [];

    const result = await options.submitPaymentOnboarding({
      notes: getOptionalBodyString(body, "notes"),
      provider,
      requiredDocuments,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      paymentOnboarding: result.paymentOnboarding,
    });
  });
}
