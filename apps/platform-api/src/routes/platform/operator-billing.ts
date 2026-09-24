import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getOptionalBodyString, getRequiredBodyString } from "../shared.js";
import { getPlatformAccess } from "./operator-access.js";

type OperatorBillingOptions = Pick<
  PlatformAppOptions,
  | "authorizePlatformPermission"
  | "createEntitlementOverride"
  | "createPlan"
  | "getEntitlementSummary"
  | "getPlanAdministrationCatalog"
  | "getSession"
  | "getSuperadminDiagnostics"
  | "getSuperadminOperationalSummary"
  | "migrateSubscriptionPlanVersion"
  | "publishPlanDraft"
  | "revokeEntitlementOverride"
  | "savePlanDraft"
  | "savePlanPresentation"
>;

export function registerPlatformOperatorBillingRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: OperatorBillingOptions,
) {
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

  app.post("/platform/operator/billing/plans", async (context) => {
    if (!options.createPlan) return context.json({ error: "billing_plans_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "billing.plans.update",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const draftRecord =
      record.draft && typeof record.draft === "object"
        ? (record.draft as Record<string, unknown>)
        : {};
    const result = await options.createPlan({
      actorUserId: access.session.user.id,
      basePlanVersionId:
        typeof record.basePlanVersionId === "string" ? record.basePlanVersionId : null,
      code: typeof record.code === "string" ? record.code : "",
      draft: {
        billingInterval:
          draftRecord.billingInterval === "day" ||
          draftRecord.billingInterval === "week" ||
          draftRecord.billingInterval === "year"
            ? draftRecord.billingInterval
            : "month",
        currency: typeof draftRecord.currency === "string" ? draftRecord.currency : "",
        features: draftRecord.features,
        limits: draftRecord.limits,
        name: typeof draftRecord.name === "string" ? draftRecord.name : "",
        price: typeof draftRecord.price === "string" ? draftRecord.price : "",
        trialPolicy: draftRecord.trialPolicy,
      },
      kind: record.kind === "custom" ? "custom" : "standard",
      platformPrincipalId: access.authorization.principal.id,
      reason: typeof record.reason === "string" ? record.reason : "",
      tenantId: typeof record.tenantId === "string" ? record.tenantId : null,
      visibility: record.visibility === "public" ? "public" : "private",
    });
    return result.ok
      ? context.json({ planId: result.planId }, 201)
      : context.json({ error: result.error }, result.status);
  });

  app.put("/platform/operator/billing/plans/:planId/presentation", async (context) => {
    if (!options.savePlanPresentation) {
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
    const result = await options.savePlanPresentation({
      actorUserId: access.session.user.id,
      planId: context.req.param("planId"),
      platformPrincipalId: access.authorization.principal.id,
      presentation: {
        badge: typeof record.badge === "string" ? record.badge : null,
        ctaLabel: typeof record.ctaLabel === "string" ? record.ctaLabel : "",
        description: typeof record.description === "string" ? record.description : "",
        displayOrder: typeof record.displayOrder === "number" ? record.displayOrder : -1,
        featureList: record.featureList,
        featured: record.featured === true,
        landingVisible: record.landingVisible === true,
        publicName: typeof record.publicName === "string" ? record.publicName : "",
        summary: typeof record.summary === "string" ? record.summary : "",
        visibility: record.visibility === "public" ? "public" : "private",
      },
      reason: typeof record.reason === "string" ? record.reason : "",
    });
    return result.ok
      ? context.json({ presentationId: result.presentationId })
      : context.json({ error: result.error }, result.status);
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
        trialPolicy: record.trialPolicy,
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
}
