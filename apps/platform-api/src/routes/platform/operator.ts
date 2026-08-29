import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { PlatformPermission } from "../../context/platform-authorization.js";
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
  app.get("/platform/operator/session", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const access = await options.getPlatformPrincipalAccess?.(session.user.id);
    if (!access) return context.json({ error: "operator_forbidden" }, 403);
    return context.json({
      operator: { id: session.user.id, email: session.user.email, name: session.user.name },
      principalId: access.principal.id,
      permissions: access.permissions,
    });
  });

  app.get("/platform/operator/overview", async (context) => {
    if (!options.getSuperadminOverview) {
      return context.json({ error: "operator_overview_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.overview.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getSuperadminOverview());
  });

  app.get("/platform/operator/work", async (context) => {
    if (!options.listSuperadminWork)
      return context.json({ error: "operator_work_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(
      await options.listSuperadminWork({
        kind: context.req.query("kind") === "background_job" ? "background_job" : "shop_setup",
        limit: getPaginationValue(context.req.query("limit"), 20, 100),
        offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      }),
    );
  });

  app.post("/platform/operator/work/:attemptId/recover", async (context) => {
    if (!options.recoverSuperadminWork) {
      return context.json({ error: "operator_recovery_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.retry");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const reason = getRequiredBodyString(body, "reason");
    if (!reason || reason.length < 10) {
      return context.json({ error: "recovery_reason_required" }, 400);
    }
    const result = await options.recoverSuperadminWork({
      attemptId: context.req.param("attemptId"),
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
    });
    return result.ok
      ? context.json({ tenant: result.tenant })
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/operator/audit", async (context) => {
    if (!options.listSuperadminAudit)
      return context.json({ error: "operator_audit_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.audit.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const category = getAuditCategory(context.req.query("category"));
    const from = getAuditDate(context.req.query("from"));
    const to = getAuditDate(context.req.query("to"), true);
    return context.json(
      await options.listSuperadminAudit({
        ...getBoundedAuditFilter("action", context.req.query("action")),
        ...getBoundedAuditFilter("actor", context.req.query("actor")),
        ...(category ? { category } : {}),
        ...(from ? { from } : {}),
        limit: getPaginationValue(context.req.query("limit"), 20, 100),
        ...getBoundedAuditFilter("merchant", context.req.query("merchant")),
        offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
        ...getAuditOutcome(context.req.query("outcome")),
        ...getBoundedAuditFilter("resource", context.req.query("resource")),
        ...(to ? { to } : {}),
      }),
    );
  });

  app.get("/platform/operator/operators", async (context) => {
    if (!options.listPlatformOperators)
      return context.json({ error: "operators_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.operators.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.listPlatformOperators());
  });

  app.get("/platform/operator/health", async (context) => {
    if (!options.getPlatformHealth) {
      return context.json({ error: "operator_health_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.health.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getPlatformHealth());
  });

  app.get("/platform/operator/tenants/:tenantId/entitlements", async (context) => {
    if (!options.getEntitlementSummary) {
      return context.json({ error: "entitlements_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.entitlements.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(
      await options.getEntitlementSummary({ tenantId: context.req.param("tenantId") }),
    );
  });

  app.get("/platform/operator/billing/plans", async (context) => {
    if (!options.getPlanAdministrationCatalog) {
      return context.json({ error: "billing_plans_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "billing.plans.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getPlanAdministrationCatalog());
  });

  app.put("/platform/operator/billing/plans/:planId/draft", async (context) => {
    if (!options.savePlanDraft) {
      return context.json({ error: "billing_plans_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.plans.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await options.savePlanDraft({
      actorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      planId: context.req.param("planId"),
      reason: getRequiredBodyString(body, "reason") ?? "",
      draft: {
        billingInterval:
          record.billingInterval === "day" ||
          record.billingInterval === "week" ||
          record.billingInterval === "year"
            ? record.billingInterval
            : "month",
        currency: getRequiredBodyString(body, "currency") ?? "",
        features: record.features,
        limits: record.limits,
        name: getRequiredBodyString(body, "name") ?? "",
        price: getRequiredBodyString(body, "price") ?? "",
      },
    });
    return result.ok
      ? context.json({ draft: result.draft })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/operator/billing/plans/:planId/publish", async (context) => {
    if (!options.publishPlanDraft) {
      return context.json({ error: "billing_plans_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.plans.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const result = await options.publishPlanDraft({
      actorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      planId: context.req.param("planId"),
      reason: getRequiredBodyString(body, "reason") ?? "",
    });
    return result.ok
      ? context.json({ publication: result.publication })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/operator/tenants/:tenantId/billing/plan-version", async (context) => {
    if (!options.migrateSubscriptionPlanVersion) {
      return context.json({ error: "billing_plans_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.subscriptions.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const result = await options.migrateSubscriptionPlanVersion({
      actorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      planVersionId: getRequiredBodyString(body, "planVersionId") ?? "",
      reason: getRequiredBodyString(body, "reason") ?? "",
      tenantId: context.req.param("tenantId"),
    });
    return result.ok
      ? context.json({ subscriptionId: result.subscriptionId })
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/operator/tenants/:tenantId/operations", async (context) => {
    if (!options.getSuperadminOperationalSummary) {
      return context.json({ error: "operator_summary_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.operations.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.getSuperadminOperationalSummary({
      tenantId: context.req.param("tenantId"),
    });
    return result.ok
      ? context.json(result.summary)
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/operator/tenants/:tenantId/diagnostics", async (context) => {
    if (!options.getSuperadminDiagnostics) {
      return context.json({ error: "operator_diagnostics_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "tenants.diagnostics.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(
      await options.getSuperadminDiagnostics({ tenantId: context.req.param("tenantId") }),
    );
  });

  app.post("/platform/operator/tenants/:tenantId/entitlements/:key/overrides", async (context) => {
    if (!options.createEntitlementOverride) {
      return context.json({ error: "entitlements_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.entitlements.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);

    const key = context.req.param("key");
    if (key !== "customDomains") {
      return context.json({ error: "entitlement_key_invalid" }, 400);
    }
    const body = await getJsonBody(context.req.raw);
    const reason = getRequiredBodyString(body, "reason");
    const value = body && typeof body === "object" ? Reflect.get(body, "value") : undefined;
    const expiresAtValue = getOptionalBodyString(body, "expiresAt");
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
    if (!reason || typeof value !== "boolean" || !expiresAt || Number.isNaN(expiresAt.getTime())) {
      return context.json({ error: "entitlement_override_invalid" }, 400);
    }

    const result = await options.createEntitlementOverride({
      expiresAt,
      key,
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
      tenantId: context.req.param("tenantId"),
      value,
    });
    return result.ok
      ? context.json({ override: result.override }, 201)
      : context.json({ error: result.error }, result.status);
  });

  app.delete(
    "/platform/operator/tenants/:tenantId/entitlements/:key/overrides/:overrideId",
    async (context) => {
      if (!options.revokeEntitlementOverride) {
        return context.json({ error: "entitlements_unavailable" }, 503);
      }
      const access = await getPlatformAccess(
        options,
        context.req.raw.headers,
        "billing.entitlements.update",
      );
      if (!access.ok) return context.json({ error: access.error }, access.status);
      if (context.req.param("key") !== "customDomains") {
        return context.json({ error: "entitlement_key_invalid" }, 400);
      }
      const body = await getJsonBody(context.req.raw);
      const reason = getRequiredBodyString(body, "reason");
      if (!reason) return context.json({ error: "entitlement_override_invalid" }, 400);

      const result = await options.revokeEntitlementOverride({
        operatorUserId: access.session.user.id,
        overrideId: context.req.param("overrideId"),
        platformPrincipalId: access.authorization.principal.id,
        reason,
        tenantId: context.req.param("tenantId"),
      });
      return result.ok
        ? context.json({ override: result.override })
        : context.json({ error: result.error }, result.status);
    },
  );

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

function getAuditCategory(value: string | undefined) {
  return value === "billing" ||
    value === "merchant" ||
    value === "provisioning" ||
    value === "support"
    ? value
    : undefined;
}

function getAuditOutcome(
  value: string | undefined,
): { outcome: "accepted" | "completed" | "failed" | "unknown" } | Record<string, never> {
  return value === "accepted" || value === "completed" || value === "failed" || value === "unknown"
    ? { outcome: value }
    : {};
}

function getBoundedAuditFilter<K extends "action" | "actor" | "merchant" | "resource">(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  const normalized = value?.trim().slice(0, 100);
  return normalized ? ({ [key]: normalized } as Partial<Record<K, string>>) : {};
}

function getAuditDate(value: string | undefined, exclusiveEnd = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

async function getPlatformAccess(
  options: PlatformAppOptions,
  headers: Headers,
  permission: PlatformPermission,
) {
  const session = await options.getSession?.(headers);
  if (!session)
    return { ok: false as const, error: "auth_required" as const, status: 401 as const };
  const authorization = await options.authorizePlatformPermission?.({
    permission,
    userId: session.user.id,
  });
  if (!authorization?.ok) {
    return { ok: false as const, error: "operator_forbidden" as const, status: 403 as const };
  }
  if (
    requiresRecentAuthentication(permission) &&
    !isRecentPlatformAuthentication(session.session?.createdAt)
  ) {
    return {
      ok: false as const,
      error: "reauthentication_required" as const,
      status: 403 as const,
    };
  }
  return { ok: true as const, authorization, session };
}

const RECENT_AUTHENTICATION_MS = 10 * 60 * 1_000;

function requiresRecentAuthentication(permission: PlatformPermission) {
  return (
    permission === "billing.entitlements.update" ||
    permission === "platform.work.retry" ||
    permission === "payments.onboarding.review" ||
    permission === "billing.invoices.update" ||
    permission === "tenants.status.update" ||
    permission === "tenants.support.access.manage"
  );
}

export function isRecentPlatformAuthentication(value: Date | string | undefined, now = Date.now()) {
  if (!value) return false;
  const createdAt = value instanceof Date ? value.getTime() : Date.parse(value);
  return (
    Number.isFinite(createdAt) && createdAt <= now && now - createdAt <= RECENT_AUTHENTICATION_MS
  );
}
