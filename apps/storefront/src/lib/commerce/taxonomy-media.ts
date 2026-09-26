import type { StoreCategory, StoreCollection, StoreProduct } from "./types";

function productCover(product: StoreProduct | undefined) {
  return (
    product?.thumbnailVariants?.w800 ??
    product?.thumbnailVariants?.w400 ??
    product?.thumbnail ??
    null
  );
}

export function resolveCategoryMedia(
  category: StoreCategory,
  products: StoreProduct[],
): string | null {
  return (
    category.mediaUrl?.trim() ||
    productCover(products.find((product) => product.categoryIds.includes(category.id)))
  );
}

export function resolveCollectionMedia(
  collection: StoreCollection,
  products: StoreProduct[],
): string | null {
  return (
    collection.mediaUrl?.trim() ||
    productCover(products.find((product) => product.collectionId === collection.id))
  );
}
