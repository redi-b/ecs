import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerMerchantCatalogRoutes } from "./catalog.js";
import { createMerchantRouteHelpers } from "./context.js";
import { registerMerchantDashboardRoutes } from "./dashboard.js";
import { registerMerchantOrderRoutes } from "./orders.js";
import { registerMerchantProductRoutes } from "./products.js";

export function registerMerchantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  const helpers = createMerchantRouteHelpers(options);

  registerMerchantDashboardRoutes(app, options, helpers);
  registerMerchantProductRoutes(app, options, helpers);
  registerMerchantOrderRoutes(app, options, helpers);
  registerMerchantCatalogRoutes(app, options, helpers);
}
