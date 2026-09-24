import type { ProductOptionMediaBindings, ProductOptionSwatch } from "@ecs/contracts";
import type { TenantResolutionResult } from "../context/tenant-resolver.js";
import type {
  MerchantCustomerAddressInput,
  MerchantCustomerAddressResult,
  MerchantCustomerGroupsResult,
  MerchantCustomerResult,
  MerchantCustomersResult,
} from "./customer.js";
import type {
  MediaAssetDeleteResult,
  MediaAssetListResult,
  MediaAssetResult,
  MediaUploadCreateResult,
} from "./media.js";
import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductWriteResult,
} from "./merchant-product.js";
import type { StorefrontTemplateSelectionResult } from "./storefront.js";

export type PlatformResourceOptions = {
  selectStorefrontTemplate?:
    | ((input: {
        tenantId: string;
        templateKey: string;
        mode?: "clean" | "resume";
        userId: string;
      }) => Promise<StorefrontTemplateSelectionResult>)
    | undefined;
  updateMerchantProduct?:
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
        productId: string;
        regionId?: string | null | undefined;
        salesChannelId: string;
        shippingProfileId?: string | null | undefined;
        status?: string | null | undefined;
        stockLocationId?: string | null | undefined;
        tenantId?: string;
        thumbnail?: string | null | undefined;
        title?: string | null | undefined;
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
  deleteMerchantProduct?:
    | ((input: { productId: string; salesChannelId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductsBatch?:
    | ((input: {
        productIds: string[];
        salesChannelId: string;
      }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  deleteMerchantProductCategory?:
    | ((input: { categoryId: string; tenantId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductCategoriesBatch?:
    | ((input: { categoryIds: string[]; tenantId: string }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  deleteMerchantProductCollection?:
    | ((input: { collectionId: string; tenantId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductCollectionsBatch?:
    | ((input: { collectionIds: string[]; tenantId: string }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  createMediaUpload?:
    | ((input: {
        accessMode: "public" | "private";
        byteSize: number;
        context: "product" | "editor" | "settings" | "media-library";
        filename: string;
        mimeType: string;
        tenantId: string;
        userId: string;
      }) => Promise<MediaUploadCreateResult>)
    | undefined;
  completeMediaUpload?:
    | ((input: {
        altText?: string | null | undefined;
        assetId: string;
        height?: number | null | undefined;
        tenantId: string;
        width?: number | null | undefined;
      }) => Promise<MediaAssetResult>)
    | undefined;
  listMediaAssets?:
    | ((input: {
        publicOnly?: boolean | undefined;
        limit: number;
        mimeType?: string | undefined;
        offset: number;
        orientation?: "landscape" | "portrait" | "square" | undefined;
        query?: string | undefined;
        size?: "small" | "medium" | "large" | undefined;
        sort?: "newest" | "oldest" | "name_asc" | "name_desc" | "largest" | "smallest" | undefined;
        tenantId: string;
      }) => Promise<MediaAssetListResult>)
    | undefined;
  updateMediaMetadata?:
    | ((input: {
        altText?: string | null | undefined;
        assetId: string;
        displayName?: string | undefined;
        tenantId: string;
      }) => Promise<MediaAssetResult>)
    | undefined;
  deleteMediaAsset?:
    | ((input: { assetId: string; tenantId: string }) => Promise<MediaAssetDeleteResult>)
    | undefined;
  listMerchantCustomers?:
    | ((input: {
        limit: number;
        offset: number;
        query?: string | undefined;
        tenantId: string;
      }) => Promise<MerchantCustomersResult>)
    | undefined;
  getMerchantCustomer?:
    | ((input: { customerId: string; tenantId: string }) => Promise<MerchantCustomerResult>)
    | undefined;
  createMerchantCustomer?:
    | ((input: {
        companyName?: string | null | undefined;
        email: string;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | null | undefined;
        tenantId: string;
      }) => Promise<MerchantCustomerResult>)
    | undefined;
  ensureMerchantCustomer?:
    | ((input: {
        companyName?: string | null | undefined;
        email: string;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | null | undefined;
        tenantId: string;
      }) => Promise<MerchantCustomerResult>)
    | undefined;
  updateMerchantCustomer?:
    | ((input: {
        companyName?: string | null | undefined;
        customerId: string;
        email: string;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | null | undefined;
        tenantId: string;
      }) => Promise<MerchantCustomerResult>)
    | undefined;
  createMerchantCustomerAddress?:
    | ((input: {
        address: MerchantCustomerAddressInput;
        customerId: string;
        tenantId: string;
      }) => Promise<MerchantCustomerAddressResult>)
    | undefined;
  updateMerchantCustomerAddress?:
    | ((input: {
        address: MerchantCustomerAddressInput;
        addressId: string;
        customerId: string;
        tenantId: string;
      }) => Promise<MerchantCustomerAddressResult>)
    | undefined;
  deleteMerchantCustomerAddress?:
    | ((input: {
        addressId: string;
        customerId: string;
        tenantId: string;
      }) => Promise<MerchantCustomerAddressResult>)
    | undefined;
  listMerchantCustomerGroups?:
    | ((input: { tenantId: string }) => Promise<MerchantCustomerGroupsResult>)
    | undefined;
  syncProductMedia?:
    | ((input: {
        imageUrls: string[];
        variantImageUrls?: string[] | undefined;
        productId: string;
        tenantId: string;
        thumbnail: string | null;
      }) => Promise<{ count: number; ok: true }>)
    | undefined;
  serviceName: string;
  medusaInternalUrl: string;
  platformPublicBaseUrl: string;
  /** Shared secret for machine-to-machine routes (Medusa → platform ingest, etc.). */
  internalApiToken?: string | undefined;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};
