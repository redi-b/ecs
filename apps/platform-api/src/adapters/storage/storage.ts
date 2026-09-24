export type MediaAccessMode = "public" | "private";

export type StorageUploadRequest = {
  accessMode: MediaAccessMode;
  byteSize: number;
  mimeType: string;
  objectKey: string;
};

export type StorageUploadDescriptor = {
  headers: Record<string, string>;
  method: "PUT";
  publicUrl: string | null;
  uploadUrl: string;
};

export type StoredObjectMetadata = {
  byteSize: number;
  contentType: string | null;
};

export type StorageAdapter = {
  bucket: string;
  checkHealth(): Promise<void>;
  createUpload(input: StorageUploadRequest): Promise<StorageUploadDescriptor>;
  deleteObject(objectKey: string): Promise<void>;
  getObject(objectKey: string): Promise<Uint8Array | null>;
  getObjectMetadata(objectKey: string): Promise<StoredObjectMetadata | null>;
  provider: string;
  putObject(input: {
    body: Uint8Array;
    cacheControl?: string;
    contentType: string;
    objectKey: string;
  }): Promise<{ publicUrl: string | null }>;
};

export class MediaStorageUnavailableError extends Error {
  constructor() {
    super("Media storage is not configured.");
    this.name = "MediaStorageUnavailableError";
  }
}

export function createUnavailableStorageAdapter(): StorageAdapter {
  const unavailable = async () => {
    throw new MediaStorageUnavailableError();
  };

  return {
    bucket: "unconfigured",
    checkHealth: unavailable,
    createUpload: unavailable,
    deleteObject: unavailable,
    getObject: unavailable,
    getObjectMetadata: unavailable,
    provider: "unconfigured",
    putObject: unavailable,
  };
}
