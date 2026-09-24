import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerPlatformBillingCatalogRoutes } from "./billing-catalog.js";
import { registerDeliveryRoutes } from "./delivery-routes.js";
import { registerPlatformHealthAuthRoutes } from "./health-auth.js";
import { registerPlatformInquiryRoutes } from "./inquiries.js";
import { registerPlatformInternalNotificationRoutes } from "./internal-notifications.js";
import { registerLaunchReadinessRoutes } from "./launch-readiness.js";
import { registerPlatformOnboardingRoutes } from "./onboarding.js";
import { registerPlatformOperatorBillingRoutes } from "./operator-billing.js";
import { registerPlatformOperatorContentRoutes } from "./operator-content.js";
import { registerPlatformOperatorOperationsRoutes } from "./operator-operations.js";
import { registerPlatformOperatorTenantRoutes } from "./operator-tenants.js";
import { registerPlatformStorefrontRoutes } from "./storefront.js";
import { registerPlatformTenantCommerceRoutes } from "./tenant-commerce/index.js";
import { registerPlatformTenantOpsRoutes } from "./tenant-ops.js";
import { registerPlatformTenantRoutes } from "./tenants.js";

export function registerPlatformRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  registerPlatformHealthAuthRoutes(app, options);
  registerPlatformBillingCatalogRoutes(app, options);
  registerPlatformInternalNotificationRoutes(app, options);
  registerPlatformOnboardingRoutes(app, options);
  registerPlatformTenantCommerceRoutes(app, options);
  registerPlatformTenantRoutes(app, options);
  registerLaunchReadinessRoutes(app, options);
  registerPlatformInquiryRoutes(app, options);
  registerPlatformStorefrontRoutes(app, options);
  registerPlatformTenantOpsRoutes(app, options);
  registerPlatformOperatorContentRoutes(app, options);
  registerPlatformOperatorOperationsRoutes(app, options);
  registerPlatformOperatorBillingRoutes(app, options);
  registerPlatformOperatorTenantRoutes(app, options);
  registerDeliveryRoutes(app, options);
}
