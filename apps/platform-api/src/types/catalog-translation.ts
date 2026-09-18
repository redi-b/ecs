import type {
  CatalogTranslationQueue,
  CatalogTranslationResource,
  CatalogTranslationResourceType,
  CatalogTranslationStatus,
  StorefrontLocale,
} from "@ecs/contracts";

export type CatalogTranslationQueueInput = {
  locale: Exclude<StorefrontLocale, "en">;
  resourceType: "product" | "product_category" | "product_collection" | "shipping_option";
  salesChannelId: string;
  shippingOptionId?: string | null | undefined;
  tenantId: string;
  limit: number;
  offset: number;
  q?: string | undefined;
  status?: CatalogTranslationStatus | undefined;
};

export type CatalogTranslationResourceInput = {
  locale: Exclude<StorefrontLocale, "en">;
  productId?: string | undefined;
  resourceId: string;
  resourceType: CatalogTranslationResourceType;
  salesChannelId: string;
  shippingOptionId?: string | null | undefined;
  tenantId: string;
};

export type CatalogTranslationReadResult =
  | { ok: true; resource: CatalogTranslationResource }
  | {
      ok: false;
      error:
        | "catalog_translation_not_found"
        | "catalog_translation_invalid"
        | "commerce_backend_error"
        | "commerce_backend_unavailable"
        | "commerce_credentials_invalid"
        | "commerce_credentials_missing";
      status: 400 | 401 | 404 | 422 | 502 | 503;
    };

export type CatalogTranslationWriteResult = CatalogTranslationReadResult;

export type CatalogTranslationQueueResult =
  | { ok: true; queue: CatalogTranslationQueue }
  | Exclude<CatalogTranslationReadResult, { ok: true }>;

export type CatalogTranslationUpdateInput = CatalogTranslationResourceInput & {
  translations: Record<string, string>;
};
