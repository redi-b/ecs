import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getRequestHost,
  getRequiredBodyString,
  storeErrorStatus,
  templateSelectionErrorStatus,
} from "../shared.js";

export function registerPlatformStorefrontRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
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

    if (!result.context.medusaRegionId) {
      return context.json({ error: "commerce_region_unavailable" }, 503);
    }

    if (!result.context.publishedRevisionId) {
      return context.json({ error: "shop_unpublished" }, 404);
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
      commerce: {
        regionId: result.context.medusaRegionId,
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

  app.get("/platform/tenants/:tenantId/storefront/draft", async (context) => {
    if (!options.getStorefrontDraft) {
      return context.json({ error: "storefront_draft_unavailable" }, 503);
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

    const result = await options.getStorefrontDraft({ tenantId });

    if (!result.ok) {
      return context.json(
        { error: result.error },
        result.error === "invalid_storefront_draft" ? 400 : 404,
      );
    }

    return context.json({
      draft: result.draft,
    });
  });

  app.post("/platform/tenants/:tenantId/storefront/draft", async (context) => {
    if (!options.updateStorefrontDraft) {
      return context.json({ error: "storefront_draft_unavailable" }, 503);
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

    if (typeof body !== "object" || body === null) {
      return context.json({ error: "invalid_request" }, 400);
    }

    const data = "data" in body ? body.data : "draftData" in body ? body.draftData : undefined;
    const themeTokens =
      "themeTokens" in body
        ? body.themeTokens
        : "draftThemeTokens" in body
          ? body.draftThemeTokens
          : undefined;

    if (data === undefined || themeTokens === undefined) {
      return context.json({ error: "missing_draft_payload" }, 400);
    }

    const result = await options.updateStorefrontDraft({
      data,
      tenantId,
      themeTokens,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json(
        { error: result.error },
        result.error === "invalid_storefront_draft" ? 400 : 404,
      );
    }

    return context.json({
      draft: result.draft,
    });
  });

  app.post("/platform/tenants/:tenantId/storefront/publish", async (context) => {
    if (!options.publishStorefrontDraft) {
      return context.json({ error: "storefront_publish_unavailable" }, 503);
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

    const result = await options.publishStorefrontDraft({
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, 404);
    }

    return context.json({
      storefront: result.storefront,
    });
  });

  app.post("/platform/tenants/:tenantId/storefront/unpublish", async (context) => {
    if (!options.unpublishStorefront) {
      return context.json({ error: "storefront_unpublish_unavailable" }, 503);
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

    const result = await options.unpublishStorefront({
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, 404);
    }

    return context.json({
      storefront: result.storefront,
    });
  });
}
