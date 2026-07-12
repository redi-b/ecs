import { z } from "zod";

import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

const mediaAssetSchema = z.object({
  accessMode: z.enum(["public", "private"]),
  altText: z.string().nullable(),
  byteSize: z.number(),
  createdAt: z.string(),
  displayName: z.string(),
  filename: z.string(),
  height: z.number().nullable(),
  id: z.string(),
  mimeType: z.string(),
  publicUrl: z.string().nullable(),
  status: z.enum(["pending", "uploaded", "processing", "ready", "failed", "deleted"]),
  updatedAt: z.string(),
  width: z.number().nullable(),
});

const createUploadResponseSchema = z.object({
  asset: mediaAssetSchema,
  headers: z.record(z.string(), z.string()),
  method: z.literal("PUT"),
  objectKey: z.string(),
  ok: z.literal(true),
  uploadUrl: z.string().url(),
});

const completeUploadResponseSchema = z.object({
  asset: mediaAssetSchema,
  ok: z.literal(true),
});
const mediaListSchema = z.object({
  assets: z.array(mediaAssetSchema),
  count: z.number(),
  limit: z.number(),
  offset: z.number(),
  ok: z.literal(true),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type MediaUploadDescriptor = z.infer<typeof createUploadResponseSchema>;

export async function getMerchantMedia(
  context: PlatformRequestContext,
  input: { limit?: number; mimeType?: string; offset?: number; query?: string } = {},
) {
  const search = new URLSearchParams({
    limit: String(input.limit ?? 24),
    offset: String(input.offset ?? 0),
  });
  if (input.query) search.set("q", input.query);
  if (input.mimeType) search.set("mimeType", input.mimeType);
  const response = await platformFetch(`/platform/merchant/media?${search}`, context);
  const data = await response.json().catch(() => null);
  if (!response.ok) return platformError(response.status, data, "media_list_failed");
  const parsed = mediaListSchema.safeParse(data);
  return parsed.success
    ? { data: parsed.data, ok: true as const, status: response.status }
    : { error: "invalid_media_list_response", ok: false as const, status: 502 };
}

export async function updateMerchantMedia(
  context: PlatformRequestContext,
  assetId: string,
  input: { altText?: string | null; displayName?: string },
) {
  return mutateMedia(context, assetId, "POST", input);
}

export async function deleteMerchantMedia(context: PlatformRequestContext, assetId: string) {
  return mutateMedia(context, assetId, "DELETE");
}

export async function createProductMediaUpload(
  context: PlatformRequestContext,
  input: {
    byteSize: number;
    context?: "editor" | "media-library" | "product" | "settings";
    filename: string;
    mimeType: string;
  },
) {
  const response = await platformFetch("/platform/merchant/media/uploads", {
    ...context,
    body: JSON.stringify({
      ...input,
      accessMode: "public",
      context: input.context ?? "product",
    }),
    contentType: "json",
    method: "POST",
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return platformError(response.status, data, "media_upload_create_failed");
  }

  const parsed = createUploadResponseSchema.safeParse(data);
  return parsed.success
    ? { data: parsed.data, ok: true as const, status: response.status }
    : { error: "invalid_media_upload_response", ok: false as const, status: 502 };
}

export async function completeProductMediaUpload(
  context: PlatformRequestContext,
  assetId: string,
  input: { altText?: string | undefined; height?: number | undefined; width?: number | undefined },
) {
  const response = await platformFetch(
    `/platform/merchant/media/uploads/${encodeURIComponent(assetId)}/complete`,
    {
      ...context,
      body: JSON.stringify(input),
      contentType: "json",
      method: "POST",
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return platformError(response.status, data, "media_upload_complete_failed");
  }

  const parsed = completeUploadResponseSchema.safeParse(data);
  return parsed.success
    ? { data: parsed.data, ok: true as const, status: response.status }
    : { error: "invalid_media_complete_response", ok: false as const, status: 502 };
}

function platformError(status: number, data: unknown, fallback: string) {
  const parsed = z.object({ error: z.string() }).safeParse(data);
  return { error: parsed.success ? parsed.data.error : fallback, ok: false as const, status };
}

async function mutateMedia(
  context: PlatformRequestContext,
  assetId: string,
  method: "DELETE" | "POST",
  input?: unknown,
) {
  const response = await platformFetch(`/platform/merchant/media/${encodeURIComponent(assetId)}`, {
    ...context,
    ...(input === undefined ? {} : { body: JSON.stringify(input), contentType: "json" as const }),
    method,
  });
  const data = await response.json().catch(() => null);
  return response.ok
    ? { data, ok: true as const, status: response.status }
    : platformError(response.status, data, "media_mutation_failed");
}
