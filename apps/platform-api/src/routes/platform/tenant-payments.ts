import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getOptionalBodyString, getRequiredBodyString } from "../shared.js";

type Dependencies = Pick<
  PlatformAppOptions,
  "authorizeDashboardForTenant" | "getSession" | "listPaymentOnboarding" | "submitPaymentOnboarding"
>;

export function registerPlatformTenantPaymentRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
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
      permission: { payments: ["manage"] },
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
      permission: { payments: ["manage"] },
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
