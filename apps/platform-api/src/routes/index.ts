import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../app.js";
import { registerMerchantRoutes } from "./merchant/index.js";
import { registerPlatformRoutes } from "./platform/index.js";
import { registerStorefrontRoutes } from "./storefront/index.js";
import { registerChapaWebhookRoutes } from "./webhooks/chapa.js";
import { registerTelegramWebhookRoutes } from "./webhooks/telegram.js";

export function registerAllRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  medusaStoreFetch: typeof fetch,
) {
  registerPlatformRoutes(app, options);
  registerChapaWebhookRoutes(app, options);
  registerTelegramWebhookRoutes(app, options);
  registerMerchantRoutes(app, options);
  registerStorefrontRoutes(app, options, medusaStoreFetch);
}
