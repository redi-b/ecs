import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

/** Marketing-safe billing catalog. No session, internal ids, or entitlement machinery. */
export function registerPlatformBillingCatalogRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/billing/plans", async (context) => {
    if (!options.getPublicPlanCatalog) {
      return context.json({ error: "billing_catalog_unavailable" }, 503);
    }
    return context.json(await options.getPublicPlanCatalog());
  });
}
