import type { StoreProduct } from "./types.js";

export type StoreSearchSuggestion = {
  collection: string | null;
  handle: string;
  price: string | null;
  thumbnail: string | null;
  title: string;
};

export function formatSearchSuggestionMoney(amount: number | null, currency: string | null) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: (currency || "ETB").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency?.toUpperCase() || "ETB"} ${amount.toLocaleString("en")}`;
  }
}

export function toStoreSearchSuggestions(products: StoreProduct[]): StoreSearchSuggestion[] {
  return products.flatMap((product) => {
    if (!product.handle?.trim() || !product.title?.trim()) return [];
    return [{
      collection: product.collectionTitle,
      handle: product.handle,
      price: formatSearchSuggestionMoney(product.priceAmount, product.currencyCode),
      thumbnail: product.thumbnail,
      title: product.title,
    }];
  });
}
