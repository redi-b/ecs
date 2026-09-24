import { createPlatformDb, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";
import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { createMedusaProductService } from "../adapters/medusa/product/service.js";
import { createMediaStorageFromEnv } from "../adapters/storage/index.js";
import { loadPlatformApiEnvFiles } from "../config/env.js";
import { fetchMedusaCatalogProducts, parseBackfillArgs, runBackfill } from "./media-backfill.js";

export async function main() {
  loadPlatformApiEnvFiles();
  const options = parseBackfillArgs(process.argv.slice(2));
  const connectionString = process.env.PLATFORM_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("PLATFORM_DATABASE_URL is required");

  const { db, pool } = createPlatformDb({ connectionString, max: 2 });
  try {
    const storage = createMediaStorageFromEnv();
    const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
    const adminTokenResult = await resolveMedusaAdminToken({
      db,
      envToken: process.env.MEDUSA_ADMIN_API_TOKEN,
      internalApiToken:
        process.env.PLATFORM_INTERNAL_API_TOKEN ??
        (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token"),
      medusaInternalUrl,
    });
    if (!adminTokenResult.ok) {
      throw new Error(`Medusa admin token unavailable: ${adminTokenResult.error}`);
    }

    const productService = createMedusaProductService({
      adminApiToken: adminTokenResult.token,
      medusaInternalUrl,
    });
    let salesChannelId: string | undefined;
    if (options.tenantId) {
      const [tenantRow] = await db
        .select({ medusaSalesChannelId: tenants.medusaSalesChannelId })
        .from(tenants)
        .where(eq(tenants.id, options.tenantId))
        .limit(1);
      salesChannelId = tenantRow?.medusaSalesChannelId ?? undefined;
    }

    await runBackfill({
      dependencies: {
        db,
        listProducts: (query) =>
          fetchMedusaCatalogProducts({
            adminApiToken: adminTokenResult.token,
            medusaInternalUrl,
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
            ...(salesChannelId ? { salesChannelId } : {}),
          }),
        ...(process.env.MEDIA_S3_PUBLIC_BASE_URL?.trim()
          ? { publicBaseUrl: process.env.MEDIA_S3_PUBLIC_BASE_URL.trim() }
          : {}),
        storage,
        updateProductMediaVariants: (input) => productService.updateProductMediaVariants(input),
      },
      options,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[media:backfill] Fatal error:", error);
  process.exit(1);
});
