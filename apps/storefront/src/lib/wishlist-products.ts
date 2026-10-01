import { getStoreProductByHandle } from "./commerce/products";
import type { HostedStoreRequest, StoreProduct } from "./commerce/types";

export class InvalidWishlistPaths extends Error {}

export async function loadWishlistProducts(
  options: HostedStoreRequest & {
    paths: unknown;
    regionId?: string | null;
  },
): Promise<StoreProduct[]> {
  if (!Array.isArray(options.paths) || options.paths.length > 48)
    throw new InvalidWishlistPaths("Invalid wishlist paths");
  const handles = [
    ...new Set(
      options.paths.map((path) => {
        if (typeof path !== "string" || path.length > 500)
          throw new InvalidWishlistPaths("Invalid wishlist path");
        const match = /^\/(?:en\/|am\/)?products\/([^/?#]+)$/.exec(path);
        if (!match) throw new InvalidWishlistPaths("Invalid wishlist path");
        let handle: string;
        try {
          handle = decodeURIComponent(match[1]!);
        } catch {
          throw new InvalidWishlistPaths("Invalid wishlist path");
        }
        if (
          !handle ||
          /[/\\?#]/.test(handle) ||
          [...handle].some((char) => char.charCodeAt(0) < 32)
        )
          throw new InvalidWishlistPaths("Invalid wishlist path");
        return handle;
      }),
    ),
  ];
  const products: StoreProduct[] = [];
  for (let index = 0; index < handles.length; index += 6) {
    const batch = await Promise.all(
      handles.slice(index, index + 6).map(async (handle) => {
        const result = await getStoreProductByHandle({ ...options, handle });
        if ("product" in result) return result.product;
        if (result.status === 404) return null;
        throw new Error("Wishlist products unavailable");
      }),
    );
    products.push(...batch.filter((product): product is StoreProduct => product !== null));
  }
  return products;
}
