import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerDeliveryRoutes } from "./delivery-routes.js";
import { registerPlatformHealthAuthRoutes } from "./health-auth.js";
import { registerPlatformInternalNotificationRoutes } from "./internal-notifications.js";
import { registerPlatformOnboardingRoutes } from "./onboarding.js";
import { registerPlatformOperatorRoutes } from "./operator.js";
import { registerPlatformStorefrontRoutes } from "./storefront.js";
import { registerPlatformTenantCommerceRoutes } from "./tenant-commerce.js";
import { registerPlatformTenantOpsRoutes } from "./tenant-ops.js";
import { registerPlatformTenantRoutes } from "./tenants.js";

export function registerPlatformRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  registerPlatformHealthAuthRoutes(app, options);
  registerPlatformInternalNotificationRoutes(app, options);
  registerPlatformOnboardingRoutes(app, options);
  registerPlatformTenantCommerceRoutes(app, options);
  registerPlatformTenantRoutes(app, options);
  registerPlatformStorefrontRoutes(app, options);
  registerPlatformTenantOpsRoutes(app, options);
  registerPlatformOperatorRoutes(app, options);
  registerDeliveryRoutes(app, options);
}
