import { createS3StorageAdapter } from "./s3-storage.js";
import { createUnavailableStorageAdapter, type StorageAdapter } from "./storage.js";

export function createMediaStorageFromEnv(env: NodeJS.ProcessEnv = process.env): StorageAdapter {
  if ((env.MEDIA_STORAGE_PROVIDER ?? "s3") !== "s3") {
    return createUnavailableStorageAdapter();
  }

  const bucket = env.MEDIA_S3_BUCKET?.trim();
  const accessKeyId = env.MEDIA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return createUnavailableStorageAdapter();
  }

  return createS3StorageAdapter({
    accessKeyId,
    bucket,
    endpoint: env.MEDIA_S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: env.MEDIA_S3_PUBLIC_BASE_URL?.trim() || undefined,
    region: env.MEDIA_S3_REGION?.trim() || "auto",
    secretAccessKey,
    uploadUrlTtlSeconds: parsePositiveInteger(env.MEDIA_UPLOAD_URL_TTL_SECONDS, 900),
  });
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
