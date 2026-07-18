import { asError, getNumber, getString, isRecord, storeFetch } from "./http.js";
import type {
  HostedStoreRequest,
  StoreCategory,
  StoreCollection,
  StorefrontError,
} from "./types.js";

export async function listStoreCollections(
  options: HostedStoreRequest & { limit?: number; offset?: number },
): Promise<{ collections: StoreCollection[]; count: number } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/collections",
    searchParams: {
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      fields: "id,title,handle,*metadata",
    },
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return asError(response.status, data, "Could not load collections.");
  }

  const rows = Array.isArray(isRecord(data) ? data.collections : null)
    ? (data as { collections: unknown[] }).collections
    : [];

  return {
    count: getNumber(isRecord(data) ? data.count : undefined) ?? rows.length,
    collections: rows
      .map((row) => {
        if (!isRecord(row)) return null;
        const id = getString(row.id);
        if (!id) return null;
        return {
          id,
          title: getString(row.title),
          handle: getString(row.handle),
        };
      })
      .filter((row): row is StoreCollection => Boolean(row)),
  };
}

export async function listStoreCategories(
  options: HostedStoreRequest & { limit?: number; offset?: number },
): Promise<{ categories: StoreCategory[]; count: number } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/product-categories",
    searchParams: {
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
      include_descendants_tree: "true",
      fields: "id,name,handle,parent_category_id,*metadata",
    },
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return asError(response.status, data, "Could not load categories.");
  }

  const rows = Array.isArray(isRecord(data) ? data.product_categories : null)
    ? (data as { product_categories: unknown[] }).product_categories
    : [];

  return {
    count: getNumber(isRecord(data) ? data.count : undefined) ?? rows.length,
    categories: rows
      .map((row) => {
        if (!isRecord(row)) return null;
        const id = getString(row.id);
        if (!id) return null;
        return {
          id,
          name: getString(row.name),
          handle: getString(row.handle),
          parentCategoryId:
            getString(row.parent_category_id) ?? getString(row.parentCategoryId),
        };
      })
      .filter((row): row is StoreCategory => Boolean(row)),
  };
}
