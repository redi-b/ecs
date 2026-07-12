export { createMediaStorageFromEnv } from "./env.js";
export type { S3StorageOptions } from "./s3-storage.js";
export { createS3StorageAdapter } from "./s3-storage.js";
export type {
  MediaAccessMode,
  StorageAdapter,
  StorageUploadDescriptor,
  StorageUploadRequest,
  StoredObjectMetadata,
} from "./storage.js";
export {
  createUnavailableStorageAdapter,
  MediaStorageUnavailableError,
} from "./storage.js";
