import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";

import { createPlatformApp } from "./app.js";
import { createDashboardAuthorizationLookup } from "./auth/dashboard-authorization.js";
import { createPlatformAuth, parseTrustedOrigins } from "./auth/platform-auth.js";
import { createMedusaProductService } from "./commerce/product-service.js";
import { getSystemHosts } from "./config/hosts.js";
import { createStorefrontTemplateService } from "./storefront/template-service.js";
import { createDomainTenantLookup } from "./tenancy/domain-tenant-lookup.js";
import { resolveTenantFromHost } from "./tenancy/tenant-resolver.js";

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});

const logger = createLogger({
  serviceName: env.SERVICE_NAME,
  environment: env.NODE_ENV,
});

const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});
const findDomainByHostname = createDomainTenantLookup(platformDb.db);
const authorizeDashboardForTenant = createDashboardAuthorizationLookup(platformDb.db);
const storefrontTemplateService = createStorefrontTemplateService(platformDb.db);
const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
const productService = createMedusaProductService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
const auth = createPlatformAuth({
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://api.lvh.me",
  db: platformDb.db,
  secret:
    process.env.BETTER_AUTH_SECRET ?? "development-better-auth-secret-change-before-production",
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [
    "http://abebe.lvh.me",
    "http://api.lvh.me",
    "http://dashboard.lvh.me",
  ],
});

const app = createPlatformApp({
  authHandler: auth.handler,
  authorizeDashboardForTenant,
  getPublishedStorefrontConfig: storefrontTemplateService.getPublishedStorefrontConfig,
  getSession: (headers) => auth.api.getSession({ headers }),
  listMerchantProducts: productService.listMerchantProducts,
  listStorefrontTemplates: storefrontTemplateService.listStorefrontTemplates,
  selectStorefrontTemplate: storefrontTemplateService.selectStorefrontTemplate,
  signInWithEmail: async ({ email, password, rememberMe, headers }) =>
    auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe,
      },
      headers,
      returnHeaders: true,
    }),
  serviceName: env.SERVICE_NAME,
  medusaInternalUrl,
  resolveTenantForHost: (host) =>
    resolveTenantFromHost({
      host,
      platformBaseDomain: process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me",
      systemHosts: getSystemHosts(process.env),
      findDomainByHostname,
    }),
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info({ port: info.port }, "platform api listening");
  },
);
