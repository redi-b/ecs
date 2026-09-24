import type { MerchantProduct } from "../../types/index.js";

/** Every product-owned media reference, including option swatches outside the gallery. */
export function getProductMediaReferences(product: MerchantProduct) {
  return {
    imageUrls: [
      ...(product.images?.flatMap((image) => (image.url ? [image.url] : [])) ?? []),
      ...(product.options?.flatMap((option) =>
        option.values.flatMap((value) =>
          value.swatch?.kind === "image" ? [value.swatch.url] : [],
        ),
      ) ?? []),
    ],
    variantImageUrls:
      product.variants?.flatMap((variant) => (variant.imageUrl ? [variant.imageUrl] : [])) ?? [],
    thumbnail: product.thumbnail,
  };
}
