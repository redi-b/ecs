import type { createPlatformDb } from "@ecs/db";
import { mediaAssets, mediaUsages } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";
import { and, eq } from "drizzle-orm";

import type { StorageAdapter } from "../../adapters/storage/index.js";
import { processMediaAssetImage } from "../../modules/media/process-asset.js";
import {
  assertProductMediaUpdateSucceeded,
  buildProductMediaVariantsMetadata,
} from "../../modules/media/service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createMediaProcessHandler(options: {
  db: PlatformDb;
  storage: StorageAdapter;
  updateProductMediaVariants?: (input: {
    mediaVariants: Record<string, Record<string, string>>;
    productId: string;
    tenantId: string;
  }) => Promise<unknown>;
}): JobHandler<{ assetId: string }> {
  return async ({ payload }) => {
    const assetId = payload?.assetId?.trim();
    if (!assetId) return { skipped: true, reason: "missing_asset" };

    const [asset] = await options.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);
    if (!asset || asset.status !== "ready") return { skipped: true, reason: "asset_not_ready" };
    if (asset.variantsStatus === "skipped") {
      return { skipped: true, reason: asset.variantsStatus };
    }

    let derivativesReady = asset.variantsStatus === "ready";
    try {
      const result = derivativesReady
        ? {
            skipped: false as const,
            variants: asset.variants,
            width: asset.width ?? undefined,
            height: asset.height ?? undefined,
          }
        : await processMediaAssetImage({
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

      derivativesReady = !result.skipped;
      if (!result.skipped && options.updateProductMediaVariants) {
        const usages = await options.db
          .select({ resourceId: mediaUsages.resourceId })
          .from(mediaUsages)
          .where(
            and(
              eq(mediaUsages.mediaAssetId, asset.id),
              eq(mediaUsages.resourceType, "product"),
              eq(mediaUsages.tenantId, asset.tenantId),
            ),
          );

        for (const productId of new Set(usages.map((usage) => usage.resourceId))) {
          const productUsages = await options.db
            .select({ asset: mediaAssets })
            .from(mediaUsages)
            .innerJoin(mediaAssets, eq(mediaUsages.mediaAssetId, mediaAssets.id))
            .where(
              and(
                eq(mediaUsages.resourceId, productId),
                eq(mediaUsages.resourceType, "product"),
                eq(mediaUsages.tenantId, asset.tenantId),
              ),
            )
            .orderBy(mediaUsages.position);

          const readyAssets = productUsages
            .filter((row) => row.asset.variantsStatus === "ready")
            .map((row) => row.asset);

          const mediaVariants = buildProductMediaVariantsMetadata(readyAssets);

          assertProductMediaUpdateSucceeded(
            await options.updateProductMediaVariants({
              mediaVariants,
              productId: productId,
              tenantId: asset.tenantId,
            }),
          );
        }
      }

      return result.skipped ? { skipped: true, reason: "unprocessable" } : { skipped: false };
    } catch (cause) {
      if (!derivativesReady)
        await options.db
          .update(mediaAssets)
          .set({ updatedAt: new Date(), variantsStatus: "failed" })
          .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, asset.tenantId)));
      throw new Error("media_process_failed", { cause });
    }
  };
}
