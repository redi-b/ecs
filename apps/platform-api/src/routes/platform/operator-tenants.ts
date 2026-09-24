import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getJsonBody,
  getOptionalBodyString,
  getPaginationValue,
  getRequiredBodyString,
} from "../shared.js";
import { getPlatformAccess } from "./operator-access.js";

type OperatorTenantOptions = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "authorizePlatformPermission"
  | "createOperatorSupportNote"
  | "createSupportAccessGrant"
  | "getOperatorSupportHistory"
  | "getSession"
  | "getSuperadminCommerceReview"
  | "getSuperadminTenant"
  | "getTenantReadiness"
  | "listBillingPaymentReviews"
  | "listSuperadminTenants"
  | "listSupportAccessGrants"
  | "listTenantProvisioningAttempts"
  | "merchantTeamService"
  | "retryTenantShopProvisioningAttempt"
  | "reviewPaymentOnboarding"
  | "revokeSupportAccessGrant"
  | "updateBillingInvoiceStatus"
  | "updateTenantStatus"
>;

export function registerPlatformOperatorTenantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: OperatorTenantOptions,
) {
  app.get("/platform/operator/tenants", async (context) => {
    if (!options.listSuperadminTenants) {
      return context.json({ error: "operator_tenants_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "tenants.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.listSuperadminTenants({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      ...(context.req.query("q")?.trim() ? { query: context.req.query("q")?.trim() } : {}),
    });
    return context.json(result);
  });

  app.get("/platform/operator/tenants/:tenantId", async (context) => {
    if (!options.getSuperadminTenant) {
      return context.json({ error: "operator_tenant_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "tenants.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.getSuperadminTenant({ tenantId: context.req.param("tenantId") });
    return result.ok
      ? context.json({ tenant: result.tenant })
      : context.json({ error: result.error }, 404);
  });

  app.get("/platform/operator/tenants/:tenantId/commerce-review", async (context) => {
    if (!options.getSuperadminCommerceReview) {
      return context.json({ error: "commerce_review_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const [billingAccess, paymentAccess] = await Promise.all([
      options.authorizePlatformPermission?.({
        permission: "billing.invoices.read",
        userId: session.user.id,
      }),
      options.authorizePlatformPermission?.({
        permission: "payments.onboarding.read",
        userId: session.user.id,
      }),
    ]);
    if (!billingAccess?.ok && !paymentAccess?.ok) {
      return context.json({ error: "operator_forbidden" }, 403);
    }
    return context.json(
      await options.getSuperadminCommerceReview({
        includeBilling: Boolean(billingAccess?.ok),
        includePayments: Boolean(paymentAccess?.ok),
        tenantId: context.req.param("tenantId"),
      }),
    );
  });

  app.post(
    "/platform/operator/tenants/:tenantId/payments/onboarding/:paymentOnboardingId/review",
    async (context) => {
      if (!options.reviewPaymentOnboarding) {
        return context.json({ error: "payments_unavailable" }, 503);
      }

      const access = await getPlatformAccess(
        options,
        context.req.raw.headers,
        "payments.onboarding.review",
      );
      if (!access.ok) return context.json({ error: access.error }, access.status);
      const session = access.session;
      const tenantId = context.req.param("tenantId");

      const body = await getJsonBody(context.req.raw);
      const status = getRequiredBodyString(body, "status");
      const reason = getRequiredBodyString(body, "reason");

      if (!status || !reason || reason.length < 10) {
        return context.json({ error: "status_and_reason_required" }, 400);
      }
      const result = await options.reviewPaymentOnboarding({
        operatorUserId: session.user.id,
        platformPrincipalId: access.authorization.principal.id,
        paymentOnboardingId: context.req.param("paymentOnboardingId"),
        providerAccountRef: getOptionalBodyString(body, "providerAccountRef"),
        reason,
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

  app.get("/platform/operator/billing/payment-reviews", async (context) => {
    if (!options.listBillingPaymentReviews) {
      return context.json({ error: "billing_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.invoices.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const limit = Math.min(Math.max(Number(context.req.query("limit")) || 20, 1), 100);
    const offset = Math.max(Number(context.req.query("offset")) || 0, 0);
    return context.json(await options.listBillingPaymentReviews({ limit, offset }));
  });

  app.post(
    "/platform/operator/tenants/:tenantId/billing/invoices/:invoiceId/status",
    async (context) => {
      if (!options.updateBillingInvoiceStatus) {
        return context.json({ error: "billing_unavailable" }, 503);
      }

      const access = await getPlatformAccess(
        options,
        context.req.raw.headers,
        "billing.invoices.update",
      );
      if (!access.ok) return context.json({ error: access.error }, access.status);
      const session = access.session;
      const tenantId = context.req.param("tenantId");

      const body = await getJsonBody(context.req.raw);
      const status = getRequiredBodyString(body, "status");
      const reason = getRequiredBodyString(body, "reason");

      if (!status || !reason || reason.length < 10) {
        return context.json({ error: "status_and_reason_required" }, 400);
      }
      const provider = getOptionalBodyString(body, "provider");
      const providerReference = getOptionalBodyString(body, "providerReference");
      if (status === "paid" && (!provider || !providerReference)) {
        return context.json({ error: "invoice_payment_reference_required" }, 400);
      }

      const result = await options.updateBillingInvoiceStatus({
        invoiceId: context.req.param("invoiceId"),
        operatorUserId: session.user.id,
        platformPrincipalId: access.authorization.principal.id,
        provider,
        providerReference,
        reason,
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

    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.status.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const session = access.session;
    const tenantId = context.req.param("tenantId");

    const body = await getJsonBody(context.req.raw);
    const status = getRequiredBodyString(body, "status");
    const reason = getRequiredBodyString(body, "reason");

    if (!status || !reason) {
      return context.json({ error: "status_and_reason_required" }, 400);
    }

    const result = await options.updateTenantStatus({
      operatorUserId: session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
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
      permission: { overview: ["read"] },
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
    if (!session) return context.json({ error: "auth_required" }, 401);

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
    if (!session) return context.json({ error: "auth_required" }, 401);

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

    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const tenantId = context.req.param("tenantId");

    const result = await options.getOperatorSupportHistory({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      tenantId,
    });

    return context.json({
      history: {
        notes: result.history.notes.map((note) => ({
          id: note.id,
          operatorUserId: note.operatorUserId,
          operator: note.operator,
          body: note.body,
          visibility: "internal" as const,
          createdAt: note.createdAt,
        })),
        auditLogs: result.history.auditLogs.map((log) => ({
          id: log.id,
          actorUserId: log.actorUserId,
          actor: log.actor,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          createdAt: log.createdAt,
        })),
      },
    });
  });

  app.get("/platform/operator/tenants/:tenantId/team-access", async (context) => {
    if (!options.merchantTeamService) {
      return context.json({ error: "team_service_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.access.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.merchantTeamService.getOverview({
      tenantId: context.req.param("tenantId"),
    });
    return result.ok
      ? context.json({ team: result.team })
      : context.json({ error: result.error }, 404);
  });

  app.post("/platform/operator/tenants/:tenantId/support/notes", async (context) => {
    if (!options.createOperatorSupportNote) {
      return context.json({ error: "support_notes_unavailable" }, 503);
    }

    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.note.create",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const session = access.session;
    const tenantId = context.req.param("tenantId");

    const body = await getJsonBody(context.req.raw);
    const noteBody = getRequiredBodyString(body, "body");

    if (!noteBody || noteBody.length > 4_000) {
      return context.json({ error: "missing_body" }, 400);
    }

    const result = await options.createOperatorSupportNote({
      body: noteBody,
      operatorUserId: session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      tenantId,
      visibility: "internal",
    });

    return context.json(
      {
        note: result.note,
      },
      201,
    );
  });

  app.get("/platform/operator/tenants/:tenantId/support-access", async (context) => {
    if (!options.listSupportAccessGrants) {
      return context.json({ error: "support_access_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.access.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(
      await options.listSupportAccessGrants({ tenantId: context.req.param("tenantId") }),
    );
  });

  app.post("/platform/operator/tenants/:tenantId/support-access", async (context) => {
    if (!options.createSupportAccessGrant) {
      return context.json({ error: "support_access_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.access.manage",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const reason = getRequiredBodyString(body, "reason");
    const expiresAtValue = getRequiredBodyString(body, "expiresAt");
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
    if (!reason || !expiresAt || Number.isNaN(expiresAt.getTime())) {
      return context.json({ error: "support_access_invalid" }, 400);
    }
    const result = await options.createSupportAccessGrant({
      expiresAt,
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
      tenantId: context.req.param("tenantId"),
    });
    return result.ok
      ? context.json({ grant: result.grant }, 201)
      : context.json({ error: result.error }, result.status);
  });

  app.delete("/platform/operator/tenants/:tenantId/support-access/:grantId", async (context) => {
    if (!options.revokeSupportAccessGrant) {
      return context.json({ error: "support_access_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.support.access.manage",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const reason = getRequiredBodyString(body, "reason");
    if (!reason) return context.json({ error: "support_access_invalid" }, 400);
    const result = await options.revokeSupportAccessGrant({
      grantId: context.req.param("grantId"),
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
      tenantId: context.req.param("tenantId"),
    });
    return result.ok
      ? context.json({ grant: result.grant })
      : context.json({ error: result.error }, result.status);
  });
}
