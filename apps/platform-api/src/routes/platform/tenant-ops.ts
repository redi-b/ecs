import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerPlatformTenantBillingRoutes } from "./tenant-billing.js";
import { registerPlatformTenantDomainRoutes } from "./tenant-domains.js";
import { registerPlatformTenantNotificationRoutes } from "./tenant-notifications.js";
import { registerPlatformTenantOverviewRoutes } from "./tenant-overview.js";
import { registerPlatformTenantPaymentRoutes } from "./tenant-payments.js";

export function registerPlatformTenantOpsRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  registerPlatformTenantNotificationRoutes(app, options);
  registerPlatformTenantOverviewRoutes(app, options);
  registerPlatformTenantBillingRoutes(app, options);
  registerPlatformTenantDomainRoutes(app, options);
  registerPlatformTenantPaymentRoutes(app, options);
}
