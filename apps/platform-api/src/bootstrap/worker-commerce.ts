import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { createMedusaOrderService } from "../adapters/medusa/order/service.js";
import { createMedusaProductService } from "../adapters/medusa/product/service.js";
import { createProductCapacityWriter } from "../modules/billing/product-capacity.js";
import { createResolveTenantIdByMedusaSalesChannel } from "../modules/tenants/resolve-by-medusa-sales-channel.js";

type WorkerCommerceRuntimeOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createLogger>;
};

export async function createWorkerCommerceRuntime(options: WorkerCommerceRuntimeOptions) {
  const medusaInternalUrl = options.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
  const token = await resolveMedusaAdminToken({
    db: options.db,
    envToken: options.env.MEDUSA_ADMIN_API_TOKEN,
    internalApiToken:
      options.env.PLATFORM_INTERNAL_API_TOKEN ??
      (options.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token"),
    logger: options.logger,
    medusaInternalUrl,
  });
  if (!token.ok) {
    options.logger.error({ error: token.error }, "worker Medusa token unavailable");
    throw new Error(`medusa_admin_token_unavailable:${token.error}`);
  }

  const orderService = createMedusaOrderService({
    adminApiToken: token.token,
    medusaInternalUrl,
  });
  const productService = createMedusaProductService({
    adminApiToken: token.token,
    medusaInternalUrl,
  });
  const resolveTenantId = createResolveTenantIdByMedusaSalesChannel(options.db);

  return {
    createCapacityLimitedProduct: createProductCapacityWriter({
      createProduct: productService.createMerchantProduct,
      db: options.db,
      listProducts: productService.listMerchantProducts,
      resolveTenantId,
    }),
    medusaInternalUrl,
    orderService,
    productService,
  };
}
