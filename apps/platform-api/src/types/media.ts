export type MediaAsset = {
  accessMode: "public" | "private";
  altText: string | null;
  byteSize: number;
  createdAt: string;
  displayName: string;
  filename: string;
  height: number | null;
  id: string;
  mimeType: string;
  publicUrl: string | null;
  status: "pending" | "uploaded" | "processing" | "ready" | "failed" | "deleted";
  updatedAt: string;
  width: number | null;
};

export type MediaServiceError = {
  error:
    | "invalid_media_asset"
    | "media_asset_in_use"
    | "media_asset_not_found"
    | "media_object_mismatch"
    | "media_storage_unavailable"
    | "media_upload_not_found";
  ok: false;
  status: 400 | 404 | 409 | 503;
};

export type MediaUploadCreateResult =
  | {
      asset: MediaAsset;
      headers: Record<string, string>;
      method: "PUT";
      objectKey: string;
      ok: true;
      uploadUrl: string;
    }
  | MediaServiceError;

export type MediaAssetResult = { asset: MediaAsset; ok: true } | MediaServiceError;

export type MediaAssetListResult = {
  assets: MediaAsset[];
  count: number;
  limit: number;
  offset: number;
  ok: true;
};

export type MediaAssetDeleteResult = { deleted: true; id: string; ok: true } | MediaServiceError;
