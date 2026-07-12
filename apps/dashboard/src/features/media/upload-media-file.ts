import { filenameToAlt, getImageDimensions } from "./media-helpers";

const acceptedTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const maxByteSize = 15 * 1024 * 1024;

export function validateMediaImageFile(file: File): "invalid_type" | "too_large" | null {
  if (!acceptedTypes.has(file.type)) return "invalid_type";
  if (file.size > maxByteSize) return "too_large";
  return null;
}

/**
 * Direct-upload a single image into the merchant media library and return its public URL.
 */
export async function uploadMediaFile(file: File): Promise<string> {
  const validation = validateMediaImageFile(file);
  if (validation === "invalid_type") throw new Error("invalid_type");
  if (validation === "too_large") throw new Error("too_large");

  const createResponse = await fetch("/admin/media/uploads", {
    body: JSON.stringify({
      byteSize: file.size,
      filename: file.name,
      mimeType: file.type,
    }),
    headers: { accept: "application/json", "content-type": "application/json" },
    method: "POST",
  });
  const descriptor = (await createResponse.json().catch(() => null)) as {
    asset?: { id?: string };
    headers?: Record<string, string>;
    uploadUrl?: string;
  } | null;
  const assetId = descriptor?.asset?.id;
  if (!createResponse.ok || !descriptor?.uploadUrl || !assetId) {
    throw new Error("create_failed");
  }

  const putResponse = await fetch(descriptor.uploadUrl, {
    body: file,
    headers: descriptor.headers ?? { "content-type": file.type },
    method: "PUT",
  });
  if (!putResponse.ok) throw new Error("upload_failed");

  const dimensions = await getImageDimensions(file);
  const completeResponse = await fetch(
    `/admin/media/uploads/${encodeURIComponent(assetId)}/complete`,
    {
      body: JSON.stringify({
        altText: filenameToAlt(file.name),
        ...dimensions,
      }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    },
  );
  const completed = (await completeResponse.json().catch(() => null)) as {
    asset?: { publicUrl?: string | null };
  } | null;
  const publicUrl = completed?.asset?.publicUrl?.trim();
  if (!completeResponse.ok || !publicUrl) throw new Error("complete_failed");
  return publicUrl;
}
