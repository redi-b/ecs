import type { ProductOptionMediaBindings, ProductOptionSwatch } from "@ecs/contracts";
import type {
  CatalogTranslationQueueInput,
  CatalogTranslationQueueResult,
  CatalogTranslationReadResult,
  CatalogTranslationResourceInput,
  CatalogTranslationUpdateInput,
  CatalogTranslationWriteResult,
} from "./catalog-translation.js";
import type {
  MerchantProductCategoriesResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductDetailResult,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
} from "./merchant-product.js";
import type {
  PaymentOnboardingListResult,
  PaymentOnboardingReviewResult,
  PaymentOnboardingSubmitResult,
} from "./payments.js";
import type { StorefrontTemplateCatalogItem } from "./storefront.js";
import type {
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantDomainVerificationResult,
  TenantShopProvisioningResult,
} from "./tenant.js";

export type PlatformCatalogOptions = {
  createMerchantProduct?:
    | ((input: {
        categoryIds?: string[] | undefined;
        collectionId?: string | null | undefined;
        currencyCode?: string | null | undefined;
        description?: string | null | undefined;
        handle?: string | null | undefined;
        imageUrls?: string[] | undefined;
        optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
        options?:
          | Array<{
              id?: string | undefined;
              title: string;
              values: Array<
                | string
                | {
                    id?: string | undefined;
                    label: string;
                    swatch?: ProductOptionSwatch | null | undefined;
                  }
              >;
            }>
          | undefined;
        priceAmount?: number | undefined;
        regionId?: string | null | undefined;
        salesChannelId: string;
        shippingProfileId?: string | null | undefined;
        status?: string | null | undefined;
        stockLocationId?: string | null | undefined;
        tenantId?: string;
        thumbnail?: string | null | undefined;
        title: string;
        variants?:
          | Array<{
              currencyCode: string;
              imageUrl?: string | null | undefined;
              optionValues: Record<string, string>;
              priceAmount: number;
              sku?: string | null | undefined;
              stockedQuantity?: number | undefined;
            }>
          | undefined;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  createMerchantProductCategory?:
    | ((input: {
        handle?: string | null | undefined;
        mediaUrl?: string | null | undefined;
        name: string;
        parentCategoryId?: string | null | undefined;
        seoDescription?: string | null | undefined;
        seoTitle?: string | null | undefined;
        tenantId: string;
        visibility?: "public" | "hidden" | undefined;
      }) => Promise<MerchantProductCategoryWriteResult>)
    | undefined;
  createMerchantProductCollection?:
    | ((input: {
        handle?: string | null | undefined;
        mediaUrl?: string | null | undefined;
        seoDescription?: string | null | undefined;
        seoTitle?: string | null | undefined;
        tenantId: string;
        title: string;
        visibility?: "public" | "hidden" | undefined;
      }) => Promise<MerchantProductCollectionWriteResult>)
    | undefined;
  listMerchantCollectionProducts?:
    | ((input: {
        collectionId: string;
        limit: number;
        offset: number;
        salesChannelId: string;
        tenantId: string;
      }) => Promise<import("./merchant-product.js").MerchantProductsResult>)
    | undefined;
  updateMerchantCollectionProducts?:
    | ((input: {
        add?: string[] | undefined;
        collectionId: string;
        remove?: string[] | undefined;
        salesChannelId: string;
        tenantId: string;
      }) => Promise<
        | { ok: true }
        | {
            ok: false;
            error:
              | "commerce_backend_unavailable"
              | "commerce_backend_error"
              | "commerce_credentials_invalid"
              | "commerce_credentials_missing"
              | "collection_not_found"
              | "collection_write_invalid"
              | "product_not_found";
            status: 400 | 401 | 404 | 502 | 503;
          }
      >)
    | undefined;
  reorderMerchantProductCategories?:
    | ((input: { items: Array<{ categoryId: string; rank: number }>; tenantId: string }) => Promise<
        | { ok: true }
        | {
            ok: false;
            error:
              | "commerce_backend_unavailable"
              | "commerce_backend_error"
              | "commerce_credentials_invalid"
              | "commerce_credentials_missing"
              | "category_not_found"
              | "category_write_invalid";
            status: 400 | 401 | 404 | 502 | 503;
          }
      >)
    | undefined;
  updateMerchantProductCategory?:
    | ((input: {
        categoryId: string;
        handle?: string | null | undefined;
        mediaUrl?: string | null | undefined;
        name: string;
        parentCategoryId?: string | null | undefined;
        rank?: number | null | undefined;
        seoDescription?: string | null | undefined;
        seoTitle?: string | null | undefined;
        tenantId: string;
        visibility?: "public" | "hidden" | undefined;
      }) => Promise<MerchantProductCategoryWriteResult>)
    | undefined;
  updateMerchantProductCollection?:
    | ((input: {
        collectionId: string;
        handle?: string | null | undefined;
        mediaUrl?: string | null | undefined;
        seoDescription?: string | null | undefined;
        seoTitle?: string | null | undefined;
        tenantId: string;
        title: string;
        visibility?: "public" | "hidden" | undefined;
      }) => Promise<MerchantProductCollectionWriteResult>)
    | undefined;
  createTenantShop?:
    | ((input: {
        shopDetails?: import("@ecs/contracts").ShopDetails;
        handle: string;
        name: string;
        ownerUserId: string;
        templateId?: string | undefined;
        templateKey?: string | undefined;
      }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  getLaunchReadiness?: (input: {
    tenantId: string;
  }) => Promise<import("@ecs/contracts").LaunchReadiness | null>;
  confirmStorefrontReview?: (input: {
    tenantId: string;
    userId: string;
    draftFingerprint: string;
  }) => Promise<boolean>;
  retryTenantShopProvisioningAttempt?:
    | ((input: { attemptId: string; userId: string }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  createTenantDomain?:
    | ((input: {
        hostname: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainCreateResult>)
    | undefined;
  listStorefrontTemplates?: (() => Promise<StorefrontTemplateCatalogItem[]>) | undefined;
  listTenantDomains?:
    | ((input: { tenantId: string }) => Promise<TenantDomainListResult>)
    | undefined;
  verifyTenantDomainOwnership?:
    | ((input: {
        domainId: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainVerificationResult>)
    | undefined;
  listPaymentOnboarding?:
    | ((input: { tenantId: string }) => Promise<PaymentOnboardingListResult>)
    | undefined;
  submitPaymentOnboarding?:
    | ((input: {
        notes?: string | null | undefined;
        provider: string;
        requiredDocuments: unknown[];
        tenantId: string;
        userId: string;
      }) => Promise<PaymentOnboardingSubmitResult>)
    | undefined;
  reviewPaymentOnboarding?:
    | ((input: {
        operatorUserId: string;
        platformPrincipalId: string;
        paymentOnboardingId: string;
        providerAccountRef?: string | null | undefined;
        reason: string;
        status: string;
        tenantId: string;
      }) => Promise<PaymentOnboardingReviewResult>)
    | undefined;
  setTenantPrimaryDomain?:
    | ((input: {
        domainId: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainPrimaryResult>)
    | undefined;
  listMerchantProducts?:
    | ((input: {
        media?: "with_media" | "without_media" | undefined;
        categoryId?: string | undefined;
        collectionId?: string | undefined;
        limit: number;
        offset: number;
        q?: string | undefined;
        salesChannelId: string;
        status?: string | undefined;
        stockLocationId?: string | null | undefined;
      }) => Promise<MerchantProductsResult>)
    | undefined;
  listMerchantProductOptionSets?: ReturnType<
    typeof import("../modules/commerce/product-option-sets.js").createProductOptionSetService
  >["list"];
  createMerchantProductOptionSet?: ReturnType<
    typeof import("../modules/commerce/product-option-sets.js").createProductOptionSetService
  >["create"];
  updateMerchantProductOptionSet?: ReturnType<
    typeof import("../modules/commerce/product-option-sets.js").createProductOptionSetService
  >["update"];
  deleteMerchantProductOptionSet?: ReturnType<
    typeof import("../modules/commerce/product-option-sets.js").createProductOptionSetService
  >["remove"];
  getMerchantProduct?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId?: string | null | undefined;
      }) => Promise<MerchantProductDetailResult>)
    | undefined;
  getMerchantCatalogTranslation?:
    | ((input: CatalogTranslationResourceInput) => Promise<CatalogTranslationReadResult>)
    | undefined;
  getMerchantCatalogTranslations?: ReturnType<
    typeof import("../adapters/medusa/catalog-translation-service.js").createMedusaCatalogTranslationService
  >["readMany"];
  listMerchantCatalogTranslationReadiness?:
    | ((input: CatalogTranslationQueueInput) => Promise<CatalogTranslationQueueResult>)
    | undefined;
  updateMerchantCatalogTranslation?:
    | ((input: CatalogTranslationUpdateInput) => Promise<CatalogTranslationWriteResult>)
    | undefined;
  updateMerchantCatalogTranslations?: ReturnType<
    typeof import("../adapters/medusa/catalog-translation-service.js").createMedusaCatalogTranslationService
  >["writeMany"];
  listMerchantProductCategories?:
    | ((input: {
        visibility?: string | undefined;
        parentId?: string | undefined;
        limit: number;
        offset: number;
        q?: string | undefined;
        tenantId: string;
      }) => Promise<MerchantProductCategoriesResult>)
    | undefined;
  listMerchantProductCollections?:
    | ((input: {
        visibility?: string | undefined;
        limit: number;
        offset: number;
        q?: string | undefined;
        tenantId: string;
      }) => Promise<MerchantProductCollectionsResult>)
    | undefined;
  getMerchantProductStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
      }) => Promise<MerchantProductStockResult>)
    | undefined;
  getMerchantProductVariantStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        variantId: string;
      }) => Promise<MerchantProductStockResult>)
    | undefined;
  updateMerchantProductStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        stockedQuantity: number;
      }) => Promise<MerchantProductStockUpdateResult>)
    | undefined;
  updateMerchantProductVariantStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        stockedQuantity: number;
        variantId: string;
      }) => Promise<MerchantProductStockUpdateResult>)
    | undefined;
};
