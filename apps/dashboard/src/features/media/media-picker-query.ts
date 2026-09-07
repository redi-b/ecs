import { z } from "zod";
import { mediaAssetSchema } from "@/lib/media-schema";
import type { MediaAsset } from "@/lib/merchant-media";

export const mediaPickerPageSchema = z.object({
  assets: z.array(mediaAssetSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export async function fetchMediaPickerPage(
  params: URLSearchParams,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`/admin/media/assets?${params}`, { signal });
  if (!response.ok) throw new Error("media_list_failed");
  const page = mediaPickerPageSchema.parse(await response.json());
  if (
    page.offset !== Number(params.get("offset")) ||
    page.limit !== Number(params.get("limit")) ||
    page.assets.length > page.limit ||
    page.assets.length > Math.max(0, page.count - page.offset) ||
    new Set(page.assets.map((asset) => asset.id)).size !== page.assets.length
  )
    throw new Error("invalid_media_page");
  return page;
}

/** Selection intentionally survives paging/search; never look it up only in the current page. */
export function toggleMediaSelection(
  current: MediaAsset[],
  asset: MediaAsset,
  multiple: boolean,
  max?: number,
) {
  if (current.some((item) => item.id === asset.id))
    return current.filter((item) => item.id !== asset.id);
  if (!multiple) return [asset];
  if (max !== undefined && current.length >= max) return current;
  return [...current, asset];
}
