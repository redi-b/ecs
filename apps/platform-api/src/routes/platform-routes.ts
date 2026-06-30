import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../app.js";
import { registerDeliveryRoutes } from "./delivery-routes.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getPaginationValue,
  getRequestHost,
  getRequiredBodyString,
  storeErrorStatus,
  templateSelectionErrorStatus,
} from "./shared.js";

function getRequestValue(body: unknown, url: URL, ...keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key);

    if (value) {
      return value;
    }
  }

  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

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

  app.on(["GET", "POST"], "/platform/payments/chapa/callback", async (context) => {
    if (!options.handleChapaPaymentCallback) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const url = new URL(context.req.raw.url);
    const body = context.req.raw.method === "POST" ? await getJsonBody(context.req.raw) : undefined;
    const result = await options.handleChapaPaymentCallback({
      providerReference: getRequestValue(body, url, "ref_id", "reference"),
      reportedStatus: getRequestValue(body, url, "status"),
      tenantId: getRequestValue(body, url, "tenant_id", "tenantId"),
      txRef: getRequestValue(body, url, "trx_ref", "tx_ref", "txRef"),
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      payment: {
        eventType: result.eventType,
        providerReference: result.providerReference,
        status: result.status,
        tenantId: result.tenantId,
        txRef: result.txRef,
      },
    });
  });

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

    if (!result.context.medusaRegionId) {
      return context.json({ error: "commerce_region_unavailable" }, 503);
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
      return context.json({ error: result.error }, 404);
    }

    return context.json({
      draft: result.draft,
    });
  });

  app.put("/platform/tenants/:tenantId/storefront/draft", async (context) => {
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

    const data = "data" in body ? body.data : undefined;
    const themeTokens = "themeTokens" in body ? body.themeTokens : undefined;

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
      return context.json({ error: result.error }, 404);
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

  registerDeliveryRoutes(app, options);

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

  app.get("/platform/tenants/:tenantId/billing", async (context) => {
    if (!options.getBillingStatus) {
      return context.json({ error: "billing_unavailable" }, 503);
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

    const result = await options.getBillingStatus({ tenantId });

    if (!result.ok) {
      return context.json({ error: result.error }, 404);
    }

    return context.json({
      billing: result.billing,
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

  app.post(
    "/platform/operator/tenants/:tenantId/payments/onboarding/:paymentOnboardingId/review",
    async (context) => {
      if (!options.reviewPaymentOnboarding) {
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

      if (!authorization?.ok || authorization.actor.role !== "operator") {
        return context.json({ error: "operator_forbidden" }, 403);
      }

      const body = await getJsonBody(context.req.raw);
      const status = getRequiredBodyString(body, "status");

      if (!status) {
        return context.json({ error: "missing_status" }, 400);
      }

      const result = await options.reviewPaymentOnboarding({
        notes: getOptionalBodyString(body, "notes"),
        operatorUserId: session.user.id,
        paymentOnboardingId: context.req.param("paymentOnboardingId"),
        providerAccountRef: getOptionalBodyString(body, "providerAccountRef"),
        status,
        tenantId,
      });

      if (!result.ok) {
        return context.json({ error: result.error }, result.status);
      }

      return context.json({
        paymentOnboarding: result.paymentOnboarding,
      });
    },
  );

  app.post(
    "/platform/operator/tenants/:tenantId/billing/invoices/:invoiceId/status",
    async (context) => {
      if (!options.updateBillingInvoiceStatus) {
        return context.json({ error: "billing_unavailable" }, 503);
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

      if (!authorization?.ok || authorization.actor.role !== "operator") {
        return context.json({ error: "operator_forbidden" }, 403);
      }

      const body = await getJsonBody(context.req.raw);
      const status = getRequiredBodyString(body, "status");

      if (!status) {
        return context.json({ error: "missing_status" }, 400);
      }

      const result = await options.updateBillingInvoiceStatus({
        invoiceId: context.req.param("invoiceId"),
        operatorUserId: session.user.id,
        provider: getOptionalBodyString(body, "provider"),
        providerReference: getOptionalBodyString(body, "providerReference"),
        status,
        tenantId,
      });

      if (!result.ok) {
        return context.json({ error: result.error }, result.status);
      }

      return context.json({
        invoice: result.invoice,
      });
    },
  );

  app.post("/platform/operator/tenants/:tenantId/status", async (context) => {
    if (!options.updateTenantStatus) {
      return context.json({ error: "tenant_status_unavailable" }, 503);
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

    if (!authorization?.ok || authorization.actor.role !== "operator") {
      return context.json({ error: "operator_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const status = getRequiredBodyString(body, "status");

    if (!status) {
      return context.json({ error: "missing_status" }, 400);
    }

    const result = await options.updateTenantStatus({
      operatorUserId: session.user.id,
      reason: getOptionalBodyString(body, "reason"),
      status,
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
    });
  });

  app.get("/platform/tenants/:tenantId/readiness", async (context) => {
    if (!options.getTenantReadiness) {
      return context.json({ error: "tenant_readiness_unavailable" }, 503);
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

    const result = await options.getTenantReadiness({
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      readiness: result.readiness,
    });
  });

  app.post("/platform/provisioning-attempts/:attemptId/retry", async (context) => {
    if (!options.retryTenantShopProvisioningAttempt) {
      return context.json({ error: "tenant_provisioning_retry_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const result = await options.retryTenantShopProvisioningAttempt({
      attemptId: context.req.param("attemptId"),
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
    });
  });

  app.get("/platform/operator/tenants/:tenantId/support", async (context) => {
    if (!options.getOperatorSupportHistory) {
      return context.json({ error: "support_history_unavailable" }, 503);
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

    if (!authorization?.ok || authorization.actor.role !== "operator") {
      return context.json({ error: "operator_forbidden" }, 403);
    }

    const result = await options.getOperatorSupportHistory({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      tenantId,
    });

    return context.json({
      history: result.history,
    });
  });

  app.post("/platform/operator/tenants/:tenantId/support/notes", async (context) => {
    if (!options.createOperatorSupportNote) {
      return context.json({ error: "support_notes_unavailable" }, 503);
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

    if (!authorization?.ok || authorization.actor.role !== "operator") {
      return context.json({ error: "operator_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const noteBody = getRequiredBodyString(body, "body");

    if (!noteBody) {
      return context.json({ error: "missing_body" }, 400);
    }

    const result = await options.createOperatorSupportNote({
      body: noteBody,
      operatorUserId: session.user.id,
      tenantId,
      visibility: getOptionalBodyString(body, "visibility"),
    });

    return context.json(
      {
        note: result.note,
      },
      201,
    );
  });
}
