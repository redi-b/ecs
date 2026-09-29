import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerMerchantCatalogRoutes } from "./catalog.js";
import { registerMerchantCatalogTranslationRoutes } from "./catalog-translations.js";
import { createMerchantRouteHelpers } from "./context.js";
import { registerMerchantCustomerRoutes } from "./customers.js";
import { registerMerchantDashboardRoutes } from "./dashboard.js";
import { registerMerchantInboxNotificationRoutes } from "./inbox-notifications.js";
import { registerMerchantInquiryRoutes } from "./inquiries.js";
import { registerInsightsRoutes } from "./insights.js";
import { registerMerchantManualOrderRoutes } from "./manual-orders.js";
import { registerMerchantMediaRoutes } from "./media.js";
import { registerMerchantOrderRoutes } from "./orders.js";
import { registerMerchantPaymentRoutes } from "./payments.js";
import { registerMerchantProductRoutes } from "./products.js";
import { registerMerchantPromotionRoutes } from "./promotions.js";
import { registerMerchantQuotationRoutes } from "./quotations.js";
import { registerMerchantSaleDraftRoutes } from "./sale-drafts.js";
import { registerMerchantSearchRoutes } from "./search.js";
import { registerMerchantTeamRoutes } from "./team.js";
import { registerMerchantTelegramNotificationRoutes } from "./telegram-notifications.js";

export function registerMerchantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  const helpers = createMerchantRouteHelpers(options);

  registerMerchantDashboardRoutes(app, options, helpers);
  registerInsightsRoutes(app, options, helpers);
  registerMerchantSearchRoutes(app, options, helpers);
  registerMerchantProductRoutes(app, options, helpers);
  registerMerchantOrderRoutes(app, options, helpers);
  registerMerchantManualOrderRoutes(app, options, helpers);
  registerMerchantCatalogRoutes(app, options, helpers);
  registerMerchantCatalogTranslationRoutes(app, options, helpers);
  registerMerchantMediaRoutes(app, options, helpers);
  registerMerchantCustomerRoutes(app, options, helpers);
  registerMerchantPromotionRoutes(app, options, helpers);
  registerMerchantQuotationRoutes(app, options, helpers);
  registerMerchantSaleDraftRoutes(app, options, helpers);
  registerMerchantTelegramNotificationRoutes(app, options, helpers);
  registerMerchantInboxNotificationRoutes(app, options, helpers);
  registerMerchantInquiryRoutes(app, options, helpers);
  registerMerchantPaymentRoutes(app, options, helpers);
  registerMerchantTeamRoutes(app, options, helpers);
}
