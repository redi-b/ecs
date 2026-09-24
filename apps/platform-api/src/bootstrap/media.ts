import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import { createMediaStorageFromEnv } from "../adapters/storage/index.js";
import { createMediaService } from "../modules/media/index.js";
import type { MediaServiceDependencies } from "../modules/media/service.js";
import { createPlatformTemplateAssetService } from "../modules/storefront/platform-template-assets.js";
import { getTemplateDemoBaseUrl } from "../modules/storefront/template-demo-url.js";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];
type PlatformLogger = Pick<ReturnType<typeof createLogger>, "info" | "warn">;
type UpdateProductMediaVariants = NonNullable<
  MediaServiceDependencies["updateProductMediaVariants"]
>;

type MediaBootstrapOptions = {
  db: PlatformDatabase;
  env: NodeJS.ProcessEnv;
  logger: PlatformLogger;
};

export function createMediaRuntime(options: MediaBootstrapOptions) {
  const storage = createMediaStorageFromEnv();
  if (storage.provider === "unconfigured") {
    options.logger.warn("Media storage is not configured; upload routes will return 503.");
  } else {
    options.logger.info(
      { bucket: storage.bucket, provider: storage.provider },
      "Media storage configured.",
    );
  }

  let updateProductMediaVariants: UpdateProductMediaVariants | undefined;
  const mediaService = createMediaService(options.db, storage, {
    updateProductMediaVariants: async (input) => updateProductMediaVariants?.(input),
  });
  const demoBaseUrl = getTemplateDemoBaseUrl(options.env.STOREFRONT_DEMO_HOST ?? "demo.lvh.me");
  const platformTemplateAssetService = createPlatformTemplateAssetService(options.db, storage, {
    demoBaseUrl,
  });

  return {
    demoBaseUrl,
    mediaService,
    platformTemplateAssetService,
    storage,
    setUpdateProductMediaVariants(callback: UpdateProductMediaVariants) {
      updateProductMediaVariants = callback;
    },
  };
}
