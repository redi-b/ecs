import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getPaginationValue,
  getRequiredBodyString,
} from "../shared.js";

export function registerPlatformOperatorRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
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

  app.get("/platform/provisioning-attempts", async (context) => {
    if (!options.listTenantProvisioningAttempts) {
      return context.json({ error: "tenant_provisioning_attempts_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const result = await options.listTenantProvisioningAttempts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      userId: session.user.id,
    });

    return context.json({
      attempts: result.attempts,
      count: result.count,
      limit: result.limit,
      offset: result.offset,
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
