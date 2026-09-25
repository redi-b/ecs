import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";

type Dependencies = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "cancelScheduledPlanDowngrade"
  | "confirmBillingPayments"
  | "createPlanUpgradeInvoice"
  | "getBillingStatus"
  | "getSession"
  | "initializeBillingInvoicePayment"
  | "schedulePlanDowngrade"
  | "startPlanTrial"
  | "submitBillingPaymentEvidence"
>;

export function registerPlatformTenantBillingRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
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
      permission: { billing: ["read"] },
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

  app.post("/platform/tenants/:tenantId/billing/trial", async (context) => {
    if (!options.startPlanTrial) {
      return context.json({ error: "billing_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
    const body = await getJsonBody(context.req.raw);
    const planVersionId =
      typeof body === "object" &&
      body &&
      typeof (body as { planVersionId?: unknown }).planVersionId === "string"
        ? (body as { planVersionId: string }).planVersionId.trim()
        : "";
    if (!planVersionId) return context.json({ error: "billing_plan_version_required" }, 400);
    const result = await options.startPlanTrial({
      actorUserId: session.user.id,
      planVersionId,
      tenantId,
    });
    return result.ok
      ? context.json({ endsAt: result.endsAt, subscriptionId: result.subscriptionId })
      : context.json({ error: result.error }, result.status);
  });

  app.post("/platform/tenants/:tenantId/billing/confirm", async (context) => {
    if (!options.confirmBillingPayments) {
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
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.confirmBillingPayments({ tenantId });
    return context.json(result);
  });

  app.post("/platform/tenants/:tenantId/billing/upgrade", async (context) => {
    if (!options.createPlanUpgradeInvoice) {
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
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const planId =
      typeof body === "object" && body && typeof (body as { planId?: unknown }).planId === "string"
        ? (body as { planId: string }).planId.trim()
        : "";
    if (!planId) {
      return context.json({ error: "billing_plan_required" }, 400);
    }

    const result = await options.createPlanUpgradeInvoice({ planId, tenantId });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({ invoice: result.invoice, reused: result.reused });
  });

  /** Schedule free-plan switch at period end (or apply immediately if period already ended). */
  app.post("/platform/tenants/:tenantId/billing/downgrade", async (context) => {
    if (!options.schedulePlanDowngrade) {
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
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const planId =
      typeof body === "object" && body && typeof (body as { planId?: unknown }).planId === "string"
        ? (body as { planId: string }).planId.trim()
        : "";
    if (!planId) {
      return context.json({ error: "billing_plan_required" }, 400);
    }

    const result = await options.schedulePlanDowngrade({ planId, tenantId });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      applied: result.applied,
      scheduled: result.scheduled,
      effectiveAt: result.effectiveAt,
      billing: result.billing,
    });
  });

  app.post("/platform/tenants/:tenantId/billing/downgrade/cancel", async (context) => {
    if (!options.cancelScheduledPlanDowngrade) {
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
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.cancelScheduledPlanDowngrade({ tenantId });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({ cancelled: result.cancelled, billing: result.billing });
  });

  app.post("/platform/tenants/:tenantId/billing/invoices/:invoiceId/pay", async (context) => {
    if (!options.initializeBillingInvoicePayment) {
      return context.json({ error: "billing_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const invoiceId = context.req.param("invoiceId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { billing: ["manage"] },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const returnUrl =
      typeof body === "object" &&
      body &&
      typeof (body as { returnUrl?: unknown }).returnUrl === "string"
        ? (body as { returnUrl: string }).returnUrl.trim()
        : "";
    const payerEmail =
      (typeof body === "object" && body && typeof (body as { email?: unknown }).email === "string"
        ? (body as { email: string }).email.trim()
        : "") ||
      session.user.email?.trim() ||
      "";

    if (!returnUrl) {
      return context.json({ error: "billing_return_url_required" }, 400);
    }

    const result = await options.initializeBillingInvoicePayment({
      invoiceId,
      payerEmail,
      returnUrl,
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error, message: result.message }, result.status);
    }

    return context.json({
      checkoutUrl: result.checkoutUrl,
      txRef: result.txRef,
      invoice: result.invoice,
    });
  });

  app.post(
    "/platform/tenants/:tenantId/billing/invoices/:invoiceId/payment-evidence",
    async (context) => {
      if (!options.submitBillingPaymentEvidence) {
        return context.json({ error: "billing_unavailable" }, 503);
      }
      const session = await options.getSession?.(context.req.raw.headers);
      if (!session) return context.json({ error: "auth_required" }, 401);

      const tenantId = context.req.param("tenantId");
      const authorization = await options.authorizeDashboardForTenant?.({
        tenantId,
        userId: session.user.id,
        permission: { billing: ["manage"] },
      });
      if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);

      const body = await getJsonBody(context.req.raw);
      const provider = getRequiredBodyString(body, "provider");
      const reference = getRequiredBodyString(body, "reference");
      if (!provider || !reference) {
        return context.json({ error: "billing_payment_evidence_invalid" }, 400);
      }
      const result = await options.submitBillingPaymentEvidence({
        invoiceId: context.req.param("invoiceId"),
        provider,
        reference,
        tenantId,
      });
      return result.ok
        ? context.json({ evidence: result.evidence })
        : context.json({ error: result.error }, result.status);
    },
  );
}
