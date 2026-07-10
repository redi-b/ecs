export function getProductsUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number; salesChannelId: string },
) {
  const url = getProductsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.options.value,variants.options.option.title,variants.prices.amount,variants.prices.currency_code,variants.inventory_items.inventory_item_id,created_at,updated_at,sales_channels.id",
  );
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

export function getProductsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/products", normalizeBaseUrl(medusaInternalUrl));
}

export function getProductDetailUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set(
    "fields",
    "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.options.value,variants.options.option.title,variants.prices.amount,variants.prices.currency_code,variants.inventory_items.inventory_item_id,created_at,updated_at,sales_channels.id",
  );

  return url;
}

export function getProductCategoriesUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number },
) {
  const url = getProductCategoriesBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    "id,name,handle,is_active,is_internal,parent_category_id,metadata,created_at,updated_at",
  );

  return url;
}

export function getProductCategoriesBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/product-categories", normalizeBaseUrl(medusaInternalUrl));
}

export function getProductCollectionsUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number },
) {
  const url = getProductCollectionsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set("fields", "id,title,handle,metadata,created_at,updated_at");

  return url;
}

export function getProductCollectionsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/collections", normalizeBaseUrl(medusaInternalUrl));
}

export function getProductUrl(medusaInternalUrl: string, productId: string) {
  return new URL(
    `/admin/products/${encodeURIComponent(productId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function getProductInventoryUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set(
    "fields",
    "id,sales_channels.id,variants.id,variants.inventory_items.inventory_item_id",
  );

  return url;
}

export function getInventoryItemUrl(medusaInternalUrl: string, inventoryItemId: string) {
  const url = new URL(
    `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );

  url.searchParams.set("fields", "id,*location_levels");

  return url;
}

export function getInventoryItemLevelsUrl(medusaInternalUrl: string, inventoryItemId: string) {
  return new URL(
    `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function getInventoryItemLevelUrl(
  medusaInternalUrl: string,
  input: { inventoryItemId: string; stockLocationId: string },
) {
  return new URL(
    `/admin/inventory-items/${encodeURIComponent(input.inventoryItemId)}/location-levels/${encodeURIComponent(input.stockLocationId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function getProductOwnershipUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set("fields", "id,sales_channels.id");

  return url;
}

export function getProductOwnershipListUrl(
  medusaInternalUrl: string,
  input: { productId: string; salesChannelId: string },
) {
  const url = getProductsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", "1");
  url.searchParams.set("offset", "0");
  url.searchParams.set("fields", "id");
  url.searchParams.set("id[]", input.productId);
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

export function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
