import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getPaginationValue,
  getRequiredBodyString,
} from "../shared.js";
import { getOptionalBodyBoolean } from "./helpers.js";

export function registerPlatformTenantOpsRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/tenants/:tenantId/notifications/preferences", async (context) => {
    if (!options.listNotificationPreferences) {
      return context.json({ error: "notifications_unavailable" }, 503);
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

    const result = await options.listNotificationPreferences({ tenantId });

    return context.json({
      preferences: result.preferences,
    });
  });

  app.post("/platform/tenants/:tenantId/notifications/preferences", async (context) => {
    if (!options.upsertNotificationPreference) {
      return context.json({ error: "notifications_unavailable" }, 503);
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
    const channel = getRequiredBodyString(body, "channel");
    const target = getRequiredBodyString(body, "target");
    const rawEvents =
      typeof body === "object" && body !== null && "events" in body
        ? (body as { events?: unknown }).events
        : undefined;

    if (!channel) {
      return context.json({ error: "missing_channel" }, 400);
    }

    if (!target) {
      return context.json({ error: "missing_target" }, 400);
    }

    if (!Array.isArray(rawEvents) || !rawEvents.every((event) => typeof event === "string")) {
      return context.json({ error: "notification_events_invalid" }, 400);
    }

    const result = await options.upsertNotificationPreference({
      channel,
      enabled: getOptionalBodyBoolean(body, "enabled", true),
      events: rawEvents,
      target,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      preference: result.preference,
    });
  });

  app.post("/platform/tenants/:tenantId/notifications/test", async (context) => {
    if (!options.sendTestNotification) {
      return context.json({ error: "notifications_unavailable" }, 503);
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
    const channel = getRequiredBodyString(body, "channel");

    if (!channel) {
      return context.json({ error: "missing_channel" }, 400);
    }

    const result = await options.sendTestNotification({
      channel,
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      ok: true,
      logId: result.logId,
      jobEnqueued: result.jobEnqueued,
    });
  });

  app.get("/platform/tenants/:tenantId/insights/summary", async (context) => {
    if (!options.getTenantInsightsSummary) {
      return context.json({ error: "insights_unavailable" }, 503);
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

    const result = await options.getTenantInsightsSummary({
      days: getPaginationValue(context.req.query("days"), 30, 365),
      tenantId,
    });

    return context.json({
      summary: result.summary,
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
}
