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

  const forcePathStyleEnv = env.MEDIA_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  const forcePathStyle =
    forcePathStyleEnv === "true" ||
    forcePathStyleEnv === "1" ||
    // Path-style is required for SeaweedFS and most self-hosted S3 APIs.
    (forcePathStyleEnv !== "false" && Boolean(env.MEDIA_S3_ENDPOINT?.trim()));

  return createS3StorageAdapter({
    accessKeyId,
    bucket,
    endpoint: env.MEDIA_S3_ENDPOINT?.trim() || undefined,
    forcePathStyle,
    internalEndpoint: env.MEDIA_S3_INTERNAL_ENDPOINT?.trim() || undefined,
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

export type MediaLimitsConfig = {
  allowedMimeTypes: string[];
  formattedMaxSize: string;
  maxFileBytes: number;
  maxFilesPerBatch: number;
};

const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export function getMediaLimitsConfig(env: NodeJS.ProcessEnv = process.env): MediaLimitsConfig {
  const maxBytes = parsePositiveInteger(env.MEDIA_MAX_FILE_BYTES, 15 * 1024 * 1024);
  const maxFiles = parsePositiveInteger(env.MEDIA_MAX_FILES_PER_BATCH, 10);
  const mb = Math.round(maxBytes / (1024 * 1024));
  const allowedMimeTypes = env.MEDIA_ALLOWED_MIME_TYPES
    ? env.MEDIA_ALLOWED_MIME_TYPES.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_MIME_TYPES;

  return {
    allowedMimeTypes: allowedMimeTypes.length > 0 ? allowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES,
    formattedMaxSize: `${mb}MB`,
    maxFileBytes: maxBytes,
    maxFilesPerBatch: maxFiles,
  };
}
