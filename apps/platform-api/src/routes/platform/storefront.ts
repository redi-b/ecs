import { storefrontSeoSettingsSchema } from "@ecs/contracts";
import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  createStorefrontPreviewToken,
  verifyStorefrontPreviewToken,
} from "../../modules/storefront/preview-token.js";
import { isTrustedStorefrontSocialImage } from "../../modules/storefront/template-service.js";
import {
  getJsonBody,
  getRequestHost,
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
        primaryDomain: {
          hostname: result.context.primaryHostname,
        },
      },
      commerce: {
        regionId: result.context.medusaRegionId,
      },
      storefront: {
        ...config.config,
        seo: config.config.seo ?? { title: null, description: null, socialImageUrl: null },
      },
    });
  });

  app.get("/platform/storefront/preview-config", async (context) => {
    const secret = options.storefrontPreviewSecret?.trim();
    if (!secret || secret.length < 32 || !options.getStorefrontDraft) {
      return context.json({ error: "storefront_preview_unavailable" }, 503);
    }
    const token = context.req.query("token")?.trim() ?? "";
    const capability = verifyStorefrontPreviewToken({ secret, token });
    if (!capability) {
      return context.json({ error: "storefront_preview_invalid" }, 401);
    }
    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const tenant = await options.resolveTenantForHost(host);
    if (!tenant.ok || tenant.context.tenantId !== capability.tenantId) {
      return context.json({ error: "storefront_preview_forbidden" }, 403);
    }
    if (!tenant.context.medusaRegionId) {
      return context.json({ error: "commerce_region_unavailable" }, 503);
    }
    const result = await options.getStorefrontDraft({ tenantId: capability.tenantId });
    if (!result.ok) {
      return context.json({ error: result.error }, 404);
    }
    context.header("cache-control", "private, no-store");
    context.header("referrer-policy", "no-referrer");
    return context.json({
      tenant: {
        id: tenant.context.tenantId,
        name: tenant.context.tenantName,
        handle: tenant.context.tenantHandle,
        status: tenant.context.status,
        domain: { id: tenant.context.domainId, hostname: tenant.context.hostname },
        primaryDomain: { hostname: tenant.context.primaryHostname },
      },
      commerce: { regionId: tenant.context.medusaRegionId },
      storefront: {
        publishedRevisionId: `preview:${capability.nonce}`,
        templateId: result.draft.templateId,
        templateVersion: result.draft.templateVersion,
        templateKey: result.draft.templateKey,
        data: result.draft.data,
        themeTokens: result.draft.themeTokens,
        publishedAt: null,
        seo: { title: null, description: null, socialImageUrl: null },
      },
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
    const mode =
      typeof body === "object" && body !== null && "mode" in body && body.mode === "clean"
        ? "clean"
        : "resume";

    if (typeof templateKey !== "string" || !templateKey.trim()) {
      return context.json({ error: "missing_template_key" }, 400);
    }

    const result = await options.selectStorefrontTemplate({
      tenantId,
      templateKey: templateKey.trim(),
      mode,
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

  app.get("/platform/tenants/:tenantId/storefront/seo", async (context) => {
    if (!options.getStorefrontSeoSettings)
      return context.json({ error: "storefront_seo_unavailable" }, 503);
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const result = await options.getStorefrontSeoSettings({ tenantId });
    return result.ok
      ? context.json({ seo: result.seo })
      : context.json({ error: result.error }, 404);
  });

  app.patch("/platform/tenants/:tenantId/storefront/seo", async (context) => {
    if (!options.updateStorefrontSeoSettings)
      return context.json({ error: "storefront_seo_unavailable" }, 503);
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const body = await getJsonBody(context.req.raw);
    const parsed = storefrontSeoSettingsSchema.safeParse(
      typeof body === "object" && body !== null && "seo" in body ? body.seo : body,
    );
    if (!parsed.success) return context.json({ error: "invalid_storefront_seo" }, 422);
    if (
      !isTrustedStorefrontSocialImage(
        parsed.data.socialImageUrl,
        process.env.MEDIA_S3_PUBLIC_BASE_URL,
      )
    ) {
      return context.json({ error: "untrusted_storefront_social_image" }, 422);
    }
    const result = await options.updateStorefrontSeoSettings({
      seo: parsed.data,
      tenantId,
      userId: session.user.id,
    });
    return result.ok
      ? context.json({ seo: result.seo })
      : context.json({ error: result.error }, 404);
  });

  app.post("/platform/tenants/:tenantId/storefront/preview-session", async (context) => {
    const secret = options.storefrontPreviewSecret?.trim();
    if (!secret || secret.length < 32 || !options.getStorefrontDraft) {
      return context.json({ error: "storefront_preview_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const draft = await options.getStorefrontDraft({ tenantId });
    if (!draft.ok) return context.json({ error: draft.error }, 404);
    const issued = createStorefrontPreviewToken({ secret, tenantId, userId: session.user.id });
    context.header("cache-control", "private, no-store");
    return context.json(issued);
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
