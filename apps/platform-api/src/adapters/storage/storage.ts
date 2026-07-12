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
  createUpload(input: StorageUploadRequest): Promise<StorageUploadDescriptor>;
  deleteObject(objectKey: string): Promise<void>;
  getObjectMetadata(objectKey: string): Promise<StoredObjectMetadata | null>;
  provider: string;
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
    createUpload: unavailable,
    deleteObject: unavailable,
    getObjectMetadata: unavailable,
    provider: "unconfigured",
  };
}
