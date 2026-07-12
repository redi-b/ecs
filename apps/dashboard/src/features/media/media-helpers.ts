import type { MediaAsset } from "@/lib/merchant-media";

export type MediaTypeFilter =
  | "all"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/gif";

export type MediaSizeFilter = "all" | "small" | "medium" | "large";
export type MediaOrientationFilter = "all" | "landscape" | "portrait" | "square";
export type MediaSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "largest"
  | "smallest";

export type MediaLibraryFilters = {
  orientation: MediaOrientationFilter;
  query: string;
  size: MediaSizeFilter;
  sort: MediaSort;
  type: MediaTypeFilter | string;
};

const SMALL_MAX = 100 * 1024;
const MEDIUM_MAX = 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMimeLabel(mimeType: string) {
  return mimeType.replace("image/", "").toUpperCase();
}

export function getAssetOrientation(asset: MediaAsset): Exclude<MediaOrientationFilter, "all"> | null {
  if (!asset.width || !asset.height) return null;
  if (asset.width === asset.height) return "square";
  return asset.width > asset.height ? "landscape" : "portrait";
}

export function matchesSizeFilter(asset: MediaAsset, size: MediaSizeFilter) {
  if (size === "all") return true;
  if (size === "small") return asset.byteSize < SMALL_MAX;
  if (size === "medium") return asset.byteSize >= SMALL_MAX && asset.byteSize < MEDIUM_MAX;
  return asset.byteSize >= MEDIUM_MAX;
}

export function matchesOrientationFilter(asset: MediaAsset, orientation: MediaOrientationFilter) {
  if (orientation === "all") return true;
  return getAssetOrientation(asset) === orientation;
}

export function filterAndSortMediaAssets(assets: MediaAsset[], filters: MediaLibraryFilters) {
  const normalized = filters.query.trim().toLocaleLowerCase();
  const filtered = assets.filter((asset) => {
    if (asset.status !== "ready") return false;
    const matchesQuery =
      !normalized ||
      `${asset.displayName} ${asset.filename} ${asset.altText ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized);
    const matchesType = filters.type === "all" || asset.mimeType === filters.type;
    return (
      matchesQuery &&
      matchesType &&
      matchesSizeFilter(asset, filters.size) &&
      matchesOrientationFilter(asset, filters.orientation)
    );
  });

  return filtered.sort((a, b) => compareMediaAssets(a, b, filters.sort));
}

export function hasActiveMediaFilters(filters: MediaLibraryFilters) {
  return Boolean(
    filters.query.trim() ||
      filters.type !== "all" ||
      filters.size !== "all" ||
      filters.orientation !== "all" ||
      filters.sort !== "newest",
  );
}

export function compareMediaAssets(a: MediaAsset, b: MediaAsset, sort: MediaSort) {
  switch (sort) {
    case "oldest":
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    case "name_asc":
      return a.displayName.localeCompare(b.displayName);
    case "name_desc":
      return b.displayName.localeCompare(a.displayName);
    case "largest":
      return b.byteSize - a.byteSize;
    case "smallest":
      return a.byteSize - b.byteSize;
    default:
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  }
}

export function filenameToAlt(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export async function getImageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const result = { height: bitmap.height, width: bitmap.width };
    bitmap.close();
    return result;
  } catch {
    return {};
  }
}

export function mediaAssetDimensionsLabel(asset: MediaAsset) {
  if (asset.width && asset.height) return `${asset.width} × ${asset.height}`;
  return null;
}
