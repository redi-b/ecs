export type AnalyticsProduct = {
  id: string;
  handle: string | null;
  title?: string | null;
  variantIds: string[];
};

/** A related-product card must not be attributed to the product being viewed. */
export function cartAnalyticsSubject(variantId: string, product?: AnalyticsProduct | null) {
  if (!variantId) return null;
  if (product?.variantIds.includes(variantId)) {
    return {
      subjectType: "product",
      subjectId: product.id,
      properties: {
        productId: product.id,
        productHandle: product.handle,
        variantId,
        identityVersion: 2,
      },
    };
  }
  return {
    subjectType: "variant",
    subjectId: variantId,
    properties: { variantId, identityVersion: 2 },
  };
}
