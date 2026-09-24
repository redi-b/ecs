import type { PlatformAppOptions } from "../types/platform-app.js";
import type { createJobsRuntime } from "./jobs.js";
import type { createMediaRuntime } from "./media.js";

type MediaAppOptionKey =
  | "completeMediaUpload"
  | "createMediaUpload"
  | "deleteMediaAsset"
  | "listMediaAssets"
  | "syncProductMedia"
  | "updateMediaMetadata";

type MediaAppOptionsInput = {
  jobsClient: ReturnType<typeof createJobsRuntime>["jobsClient"];
  runtime: ReturnType<typeof createMediaRuntime>;
};

export function createMediaAppOptions({
  jobsClient,
  runtime,
}: MediaAppOptionsInput): Pick<PlatformAppOptions, MediaAppOptionKey> {
  const { mediaService } = runtime;

  return {
    completeMediaUpload: async (input) => {
      const result = await mediaService.completeUpload(input);
      if (result.ok && jobsClient) {
        await jobsClient.enqueueJob({
          idempotencyKey: `media.process:${result.asset.id}`,
          name: "media.process",
          payload: { assetId: result.asset.id },
          tenantId: input.tenantId,
        });
      }
      return result;
    },
    createMediaUpload: mediaService.createUpload,
    deleteMediaAsset: mediaService.deleteMedia,
    listMediaAssets: mediaService.listMedia,
    syncProductMedia: mediaService.syncProductMedia,
    updateMediaMetadata: mediaService.updateMetadata,
  };
}
