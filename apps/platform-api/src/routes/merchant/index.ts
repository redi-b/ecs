import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerMerchantCatalogRoutes } from "./catalog.js";
import { createMerchantRouteHelpers } from "./context.js";
import { registerMerchantCustomerRoutes } from "./customers.js";
import { registerMerchantDashboardRoutes } from "./dashboard.js";
import { registerMerchantManualOrderRoutes } from "./manual-orders.js";
import { registerMerchantMediaRoutes } from "./media.js";
import { registerMerchantOrderRoutes } from "./orders.js";
import { registerMerchantProductRoutes } from "./products.js";
import { registerMerchantPromotionRoutes } from "./promotions.js";
import { registerMerchantSearchRoutes } from "./search.js";
import { registerMerchantInboxNotificationRoutes } from "./inbox-notifications.js";
import { registerMerchantPaymentRoutes } from "./payments.js";
import { registerMerchantTelegramNotificationRoutes } from "./telegram-notifications.js";

export function registerMerchantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  const helpers = createMerchantRouteHelpers(options);

  registerMerchantDashboardRoutes(app, options, helpers);
  registerMerchantSearchRoutes(app, options, helpers);
  registerMerchantProductRoutes(app, options, helpers);
  registerMerchantOrderRoutes(app, options, helpers);
  registerMerchantManualOrderRoutes(app, options, helpers);
  registerMerchantCatalogRoutes(app, options, helpers);
  registerMerchantMediaRoutes(app, options, helpers);
  registerMerchantCustomerRoutes(app, options, helpers);
  registerMerchantPromotionRoutes(app, options, helpers);
  registerMerchantTelegramNotificationRoutes(app, options, helpers);
  registerMerchantInboxNotificationRoutes(app, options, helpers);
  registerMerchantPaymentRoutes(app, options, helpers);
}
