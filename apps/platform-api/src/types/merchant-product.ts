export type MerchantProduct = {
  id: string;
  categoryIds?: string[];
  collectionId?: string | null;
  description?: string | null;
  title: string | null;
  handle: string | null;
  status: string | null;
  thumbnail: string | null;
  images?: MerchantProductImage[];
  variants?: MerchantProductVariant[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductImage = {
  id: string;
  url: string | null;
  rank: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductVariant = {
  id: string;
  inventoryItemId?: string | null;
  title: string | null;
  sku: string | null;
  optionValues?: MerchantProductVariantOptionValue[];
  prices: MerchantProductPrice[];
  stock?: Omit<MerchantProductStock, "productId" | "variantId" | "inventoryItemId"> | null;
};

export type MerchantProductVariantOptionValue = {
  optionTitle: string | null;
  value: string | null;
};

export type MerchantProductPrice = {
  amount: number | null;
  currencyCode: string | null;
};

export type MerchantProductsResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      products: MerchantProduct[];
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing"
        | "commerce_resource_missing";
      status: 401 | 503;
    };

export type MerchantProductDetailResult = MerchantProductWriteResult;

export type MerchantProductWriteResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing"
        | "product_conflict"
        | "product_write_invalid"
        | "product_not_found";
      status: 400 | 401 | 404 | 409 | 422 | 503;
    };

export type MerchantProductCategory = {
  id: string;
  name: string | null;
  handle: string | null;
  isActive: boolean | null;
  isInternal: boolean | null;
  parentCategoryId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductCategoriesResult =
  | {
      ok: true;
      categories: MerchantProductCategory[];
      count: number;
      limit: number;
      offset: number;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductCategoryWriteResult =
  | {
      ok: true;
      category: MerchantProductCategory;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductCollection = {
  id: string;
  title: string | null;
  handle: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductCollectionsResult =
  | {
      ok: true;
      collections: MerchantProductCollection[];
      count: number;
      limit: number;
      offset: number;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductCollectionWriteResult =
  | {
      ok: true;
      collection: MerchantProductCollection;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductStock = {
  productId: string;
  variantId: string;
  inventoryItemId: string;
  locationId: string;
  stockedQuantity: number | null;
  reservedQuantity: number | null;
  incomingQuantity: number | null;
  availableQuantity: number | null;
};

export type MerchantProductStockResult =
  | {
      ok: true;
      stock: MerchantProductStock;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing"
        | "inventory_location_unavailable"
        | "product_inventory_unavailable"
        | "product_not_found"
        | "product_variant_unsupported";
      status: 401 | 404 | 409 | 503;
    };

export type MerchantProductStockUpdateResult = MerchantProductStockResult;

export type MerchantDeleteResult =
  | {
      ok: true;
      id: string;
      deleted: boolean;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing"
        | "product_not_found"
        | "category_not_found"
        | "collection_not_found";
      status: 401 | 404 | 503;
    };

export type MerchantBatchDeleteResult =
  | {
      ok: true;
      ids: string[];
      deleted: boolean;
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 401 | 503;
    };
