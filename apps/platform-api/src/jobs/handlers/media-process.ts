import type { createPlatformDb } from "@ecs/db";
import { mediaAssets, mediaUsages } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";
import { and, eq } from "drizzle-orm";

import type { StorageAdapter } from "../../adapters/storage/index.js";
import { processMediaAssetImage } from "../../modules/media/process-asset.js";
import { buildProductMediaVariantsMetadata } from "../../modules/media/service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createMediaProcessHandler(options: {
  db: PlatformDb;
  storage: StorageAdapter;
  updateProductMediaVariants?: (input: { mediaVariants: Record<string, any>; productId: string; tenantId: string }) => Promise<any>;
}): JobHandler<{ assetId: string }> {
  return async ({ payload }) => {
    const assetId = payload?.assetId?.trim();
    if (!assetId) return { skipped: true, reason: "missing_asset" };

    const [asset] = await options.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);
    if (!asset || asset.status === "deleted") return { skipped: true, reason: "missing_asset" };
    if (asset.variantsStatus === "ready" || asset.variantsStatus === "skipped") {
      return { skipped: true, reason: asset.variantsStatus };
    }

    try {
      const result = await processMediaAssetImage({
        mimeType: asset.mimeType,
        objectKey: asset.objectKey,
        storage: options.storage,
      });
      await options.db
        .update(mediaAssets)
        .set({
          updatedAt: new Date(),
          variants: result.skipped ? {} : result.variants,
          variantsStatus: result.skipped ? "skipped" : "ready",
          ...(!result.skipped && !asset.width && result.width ? { width: result.width } : {}),
          ...(!result.skipped && !asset.height && result.height ? { height: result.height } : {}),
        })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, asset.tenantId)));

      if (!result.skipped && options.updateProductMediaVariants) {
        const usages = await options.db
          .select({ resourceId: mediaUsages.resourceId })
          .from(mediaUsages)
          .where(and(eq(mediaUsages.mediaAssetId, asset.id), eq(mediaUsages.resourceType, "product")));

        for (const usage of usages) {
          const productUsages = await options.db
            .select({ asset: mediaAssets })
            .from(mediaUsages)
            .innerJoin(mediaAssets, eq(mediaUsages.mediaAssetId, mediaAssets.id))
            .where(
              and(
                eq(mediaUsages.resourceId, usage.resourceId),
                eq(mediaUsages.resourceType, "product"),
                eq(mediaUsages.tenantId, asset.tenantId)
              )
            )
            .orderBy(mediaUsages.position);

          const readyAssets = productUsages
            .filter((row) => row.asset.variantsStatus === "ready")
            .map((row) => row.asset);

          const mediaVariants = buildProductMediaVariantsMetadata(readyAssets as any);

          await options.updateProductMediaVariants({
            mediaVariants,
            productId: usage.resourceId,
            tenantId: asset.tenantId,
          });
        }
      }

      return result.skipped ? { skipped: true, reason: "unprocessable" } : { skipped: false };
    } catch {
      await options.db
        .update(mediaAssets)
        .set({ updatedAt: new Date(), variantsStatus: "failed" })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, asset.tenantId)));
      throw new Error("media_process_failed");
    }
  };
}
