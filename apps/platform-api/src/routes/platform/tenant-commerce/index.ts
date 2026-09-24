import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../../app.js";
import { registerPlatformTenantCatalogRoutes } from "./catalog.js";
import { registerPlatformTenantOrdersRoutes } from "./orders.js";
import { registerPlatformTenantProductsRoutes } from "./products.js";
import { registerPlatformTenantSettingsRoutes } from "./settings.js";

export function registerPlatformTenantCommerceRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  registerPlatformTenantOrdersRoutes(app, options);
  registerPlatformTenantProductsRoutes(app, options);
  registerPlatformTenantCatalogRoutes(app, options);
  registerPlatformTenantSettingsRoutes(app, options);
}
