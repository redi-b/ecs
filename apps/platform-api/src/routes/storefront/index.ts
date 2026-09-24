import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerStoreFacadeRoutes } from "./facade.js";

export function registerStorefrontRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  medusaStoreFetch: typeof fetch,
) {
  registerStoreFacadeRoutes(app, options, medusaStoreFetch);
}

export { registerStoreFacadeRoutes } from "./facade.js";
