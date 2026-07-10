import type {
  MerchantProduct,
  MerchantProductCategories,
  MerchantProductCategory,
  MerchantProductCollection,
  MerchantProductCollections,
  MerchantProductStock,
  MerchantProducts,
} from "@ecs/contracts";

export type MerchantProductsResult =
  | {
      ok: true;
      products: MerchantProducts;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductMutationResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCategoriesResult =
  | ({
      ok: true;
    } & MerchantProductCategories)
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCollectionsResult =
  | ({
      ok: true;
    } & MerchantProductCollections)
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCategoryMutationResult =
  | {
      ok: true;
      category: MerchantProductCategory;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCollectionMutationResult =
  | {
      ok: true;
      collection: MerchantProductCollection;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductStockResult =
  | {
      ok: true;
      stock: MerchantProductStock;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantDeleteActionResult =
  | {
      ok: true;
      id: string;
      deleted: boolean;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantBatchDeleteActionResult =
  | {
      ok: true;
      ids: string[];
      deleted: boolean;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  options?: Array<{ title: string; values: string[] }> | undefined;
  priceAmount?: number | undefined;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
  variants?:
    | Array<{
        currencyCode: string;
        optionValues: Record<string, string>;
        priceAmount: number;
        sku?: string | null | undefined;
        stockedQuantity?: number | undefined;
      }>
    | undefined;
};
