import type { createPlatformDb } from "@ecs/db";
import { attachCatalogNameTranslations } from "../lib/attach-catalog-name-translations.js";
import { createProductCapacityWriter } from "../modules/billing/product-capacity.js";
import { createProductOptionSetService } from "../modules/commerce/product-option-sets.js";
import type { PlatformAppOptions } from "../types/platform-app.js";
import type { createCommerceRuntime } from "./commerce.js";

type CommerceRuntime = Awaited<ReturnType<typeof createCommerceRuntime>>;

type CommerceAppOptionsInput = {
  db: ReturnType<typeof createPlatformDb>["db"];
  runtime: CommerceRuntime;
  resolveTenantIdByMedusaSalesChannelId: (salesChannelId: string) => Promise<string | null>;
};

type CommerceAppOptionKey =
  | "captureOrderPaymentByTxRef"
  | "createMerchantCustomer"
  | "createMerchantCustomerAddress"
  | "createMerchantManualOrder"
  | "createMerchantProduct"
  | "createMerchantProductCategory"
  | "createMerchantProductCollection"
  | "createMerchantProductOptionSet"
  | "createMerchantPromotion"
  | "deleteMerchantCustomerAddress"
  | "deleteMerchantProduct"
  | "deleteMerchantProductCategoriesBatch"
  | "deleteMerchantProductCategory"
  | "deleteMerchantProductCollection"
  | "deleteMerchantProductCollectionsBatch"
  | "deleteMerchantProductOptionSet"
  | "deleteMerchantProductsBatch"
  | "deleteMerchantPromotion"
  | "ensureMerchantCustomer"
  | "getMerchantCatalogTranslation"
  | "getMerchantCatalogTranslations"
  | "getMerchantCustomer"
  | "getMerchantOrder"
  | "getMerchantProduct"
  | "getMerchantProductStock"
  | "getMerchantProductVariantStock"
  | "listMerchantCatalogTranslationReadiness"
  | "listMerchantCollectionProducts"
  | "listMerchantCustomerGroups"
  | "listMerchantCustomers"
  | "listMerchantOrders"
  | "listMerchantProductCategories"
  | "listMerchantProductCollections"
  | "listMerchantProductOptionSets"
  | "listMerchantProducts"
  | "listMerchantPromotions"
  | "mutateMerchantOrder"
  | "reorderMerchantProductCategories"
  | "updateMerchantCatalogTranslation"
  | "updateMerchantCatalogTranslations"
  | "updateMerchantCollectionProducts"
  | "updateMerchantCustomer"
  | "updateMerchantCustomerAddress"
  | "updateMerchantOrderSettlement"
  | "updateMerchantProduct"
  | "updateMerchantProductCategory"
  | "updateMerchantProductCollection"
  | "updateMerchantProductOptionSet"
  | "updateMerchantProductStock"
  | "updateMerchantProductVariantStock"
  | "updateMerchantPromotion";

export function createCommerceAppOptions({
  db,
  resolveTenantIdByMedusaSalesChannelId,
  runtime,
}: CommerceAppOptionsInput): Pick<PlatformAppOptions, CommerceAppOptionKey> {
  const {
    catalogTranslationService,
    customerService,
    manualOrderService,
    orderService,
    productService,
    promotionService,
  } = runtime;
  const productOptionSetService = createProductOptionSetService(db);
  const createCapacityLimitedProduct = createProductCapacityWriter({
    createProduct: productService.createMerchantProduct,
    db,
    listProducts: productService.listMerchantProducts,
    resolveTenantId: resolveTenantIdByMedusaSalesChannelId,
  });

  return {
    captureOrderPaymentByTxRef: orderService.capturePaymentByTxRef,
    createMerchantCustomer: customerService.createCustomer,
    createMerchantCustomerAddress: customerService.createCustomerAddress,
    createMerchantManualOrder: manualOrderService.createManualOrder,
    createMerchantProduct: createCapacityLimitedProduct,
    createMerchantProductCategory: productService.createMerchantProductCategory,
    createMerchantProductCollection: productService.createMerchantProductCollection,
    createMerchantProductOptionSet: productOptionSetService.create,
    createMerchantPromotion: promotionService.createPromotion,
    deleteMerchantCustomerAddress: customerService.deleteCustomerAddress,
    deleteMerchantProduct: productService.deleteMerchantProduct,
    deleteMerchantProductCategoriesBatch: productService.deleteMerchantProductCategoriesBatch,
    deleteMerchantProductCategory: productService.deleteMerchantProductCategory,
    deleteMerchantProductCollection: productService.deleteMerchantProductCollection,
    deleteMerchantProductCollectionsBatch: productService.deleteMerchantProductCollectionsBatch,
    deleteMerchantProductOptionSet: productOptionSetService.remove,
    deleteMerchantProductsBatch: productService.deleteMerchantProductsBatch,
    deleteMerchantPromotion: promotionService.deletePromotion,
    ensureMerchantCustomer: customerService.ensureCustomer,
    getMerchantCatalogTranslation: catalogTranslationService.read,
    getMerchantCatalogTranslations: catalogTranslationService.readMany,
    getMerchantCustomer: customerService.getCustomer,
    getMerchantOrder: orderService.getMerchantOrder,
    getMerchantProduct: async (input) => {
      const result = await productService.getMerchantProduct(input);
      if (!result.ok) return result;
      const [product] = await attachCatalogNameTranslations({
        items: [result.product],
        resourceType: "product",
        summarizeNames: catalogTranslationService.summarizeNames,
      });
      return product ? { ...result, product } : result;
    },
    getMerchantProductStock: productService.getMerchantProductStock,
    getMerchantProductVariantStock: productService.getMerchantProductVariantStock,
    listMerchantCatalogTranslationReadiness: catalogTranslationService.readiness,
    listMerchantCollectionProducts: productService.listMerchantCollectionProducts,
    listMerchantCustomerGroups: customerService.listGroups,
    listMerchantCustomers: customerService.listCustomers,
    listMerchantOrders: orderService.listMerchantOrders,
    listMerchantProductCategories: async (input) => {
      const result = await productService.listMerchantProductCategories(input);
      if (!result.ok) return result;
      return {
        ...result,
        categories: await attachCatalogNameTranslations({
          items: result.categories,
          resourceType: "product_category",
          summarizeNames: catalogTranslationService.summarizeNames,
        }),
      };
    },
    listMerchantProductCollections: async (input) => {
      const result = await productService.listMerchantProductCollections(input);
      if (!result.ok) return result;
      return {
        ...result,
        collections: await attachCatalogNameTranslations({
          items: result.collections,
          resourceType: "product_collection",
          summarizeNames: catalogTranslationService.summarizeNames,
        }),
      };
    },
    listMerchantProductOptionSets: productOptionSetService.list,
    listMerchantProducts: async (input) => {
      const result = await productService.listMerchantProducts(input);
      if (!result.ok) return result;
      return {
        ...result,
        products: await attachCatalogNameTranslations({
          items: result.products,
          resourceType: "product",
          summarizeNames: catalogTranslationService.summarizeNames,
        }),
      };
    },
    listMerchantPromotions: promotionService.listPromotions,
    mutateMerchantOrder: orderService.mutateMerchantOrder,
    reorderMerchantProductCategories: productService.reorderMerchantProductCategories,
    updateMerchantCatalogTranslation: catalogTranslationService.write,
    updateMerchantCatalogTranslations: catalogTranslationService.writeMany,
    updateMerchantCollectionProducts: productService.updateMerchantCollectionProducts,
    updateMerchantCustomer: customerService.updateCustomer,
    updateMerchantCustomerAddress: customerService.updateCustomerAddress,
    updateMerchantOrderSettlement: orderService.updateMerchantOrderSettlement,
    updateMerchantProduct: productService.updateMerchantProduct,
    updateMerchantProductCategory: productService.updateMerchantProductCategory,
    updateMerchantProductCollection: productService.updateMerchantProductCollection,
    updateMerchantProductOptionSet: productOptionSetService.update,
    updateMerchantProductStock: productService.updateMerchantProductStock,
    updateMerchantProductVariantStock: productService.updateMerchantProductVariantStock,
    updateMerchantPromotion: promotionService.updatePromotion,
  };
}
