import type { createPlatformDb } from "@ecs/db";
import { mediaAssets } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";
import { and, eq } from "drizzle-orm";

import type { StorageAdapter } from "../../adapters/storage/index.js";
import { processMediaAssetImage } from "../../modules/media/process-asset.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createMediaProcessHandler(options: {
  db: PlatformDb;
  storage: StorageAdapter;
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
        })
        .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, asset.tenantId)));
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
