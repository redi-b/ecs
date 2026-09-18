import {
  type CatalogTranslationResource,
  type CatalogTranslationResourceType,
  catalogTranslationFields,
  catalogTranslationQueueSchema,
  storefrontCommerceLocale,
} from "@ecs/contracts";
import type {
  CatalogTranslationQueueInput,
  CatalogTranslationQueueResult,
  CatalogTranslationReadResult,
  CatalogTranslationResourceInput,
  CatalogTranslationUpdateInput,
  CatalogTranslationWriteResult,
} from "../../types/index.js";
import { mapMedusaHttpFailure } from "./map-medusa-failure.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./product/medusa-http.js";
import {
  categoryBelongsToTenantById,
  collectionBelongsToTenantById,
  productIsInSalesChannel,
} from "./product/ownership.js";
import { getProductDetailUrl, normalizeBaseUrl } from "./product/urls.js";
import { getString, isRecord } from "./product/values.js";

const SOURCE_HASH_FIELD = "__ecs_source_hash";

type TranslationRecord = {
  id: string;
  translations: Record<string, string>;
};

type SourceResource = {
  productId: string | null;
  source: Record<string, string>;
  title: string;
};

function cleanSource(
  resourceType: CatalogTranslationResourceType,
  resource: Record<string, unknown>,
) {
  return Object.fromEntries(
    catalogTranslationFields[resourceType]
      .map((field) => [field, getString(resource[field])?.trim() ?? ""] as const)
      .filter(([, value]) => value.length > 0),
  );
}

function nestedProductResource(
  product: Record<string, unknown>,
  input: CatalogTranslationResourceInput,
) {
  if (input.resourceType === "product") {
    return input.resourceId === getString(product.id) ? product : null;
  }

  if (input.resourceType === "product_variant") {
    return Array.isArray(product.variants)
      ? product.variants.find(
          (candidate) => isRecord(candidate) && getString(candidate.id) === input.resourceId,
        )
      : null;
  }

  const options = Array.isArray(product.options) ? product.options.filter(isRecord) : [];
  if (input.resourceType === "product_option") {
    return options.find((option) => getString(option.id) === input.resourceId) ?? null;
  }

  for (const option of options) {
    if (!Array.isArray(option.values)) continue;
    const value = option.values.find(
      (candidate) => isRecord(candidate) && getString(candidate.id) === input.resourceId,
    );
    if (isRecord(value)) return value;
  }
  return null;
}

function translationStatus(source: Record<string, string>, translations: Record<string, string>) {
  const fields = Object.keys(source);
  const translatedFields = fields.filter((field) => translations[field]?.trim()).length;
  if (translatedFields === 0) return "using_english" as const;
  return translatedFields === fields.length ? ("ready" as const) : ("needs_review" as const);
}

function parseTranslation(value: unknown): TranslationRecord | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id || !isRecord(value.translations)) return null;
  return {
    id,
    translations: Object.fromEntries(
      Object.entries(value.translations).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
}

export function createMedusaCatalogTranslationService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  async function getSource(
    input: CatalogTranslationResourceInput,
  ): Promise<SourceResource | CatalogTranslationReadResult> {
    if (!options.adminApiToken?.trim()) return missingCredentials();

    if (
      input.resourceType === "product" ||
      input.resourceType === "product_variant" ||
      input.resourceType === "product_option" ||
      input.resourceType === "product_option_value"
    ) {
      const productId = input.resourceType === "product" ? input.resourceId : input.productId;
      if (!productId) {
        return { ok: false, error: "catalog_translation_invalid", status: 400 };
      }
      const response = await requestMedusa(
        fetcher,
        getProductDetailUrl(options.medusaInternalUrl, productId),
        { headers: getAdminHeaders(options.adminApiToken) },
      );
      if (response.status === 404) {
        return { ok: false, error: "catalog_translation_not_found", status: 404 };
      }
      if (!response.ok) return mapFailure(response);
      const data = await response.json().catch(() => undefined);
      const product = isRecord(data?.product) ? data.product : null;
      if (!product) {
        return { ok: false, error: "catalog_translation_not_found", status: 404 };
      }
      const owned = await productIsInSalesChannel(fetcher, options, {
        product,
        productId,
        salesChannelId: input.salesChannelId,
      });
      if (typeof owned === "object") return owned;
      if (!owned) return { ok: false, error: "catalog_translation_not_found", status: 404 };
      const resource = nestedProductResource(product, input);
      if (!isRecord(resource)) {
        return { ok: false, error: "catalog_translation_not_found", status: 404 };
      }
      const source = cleanSource(input.resourceType, resource);
      return {
        productId,
        source,
        title:
          getString(resource.title) ??
          getString(resource.value) ??
          getString(product.title) ??
          "Catalog item",
      };
    }

    if (input.resourceType === "shipping_option") {
      if (!input.shippingOptionId || input.resourceId !== input.shippingOptionId) {
        return { ok: false, error: "catalog_translation_not_found", status: 404 };
      }
      const url = new URL(
        `/admin/shipping-options/${encodeURIComponent(input.resourceId)}`,
        normalizeBaseUrl(options.medusaInternalUrl),
      );
      url.searchParams.set("fields", "id,name");
      const response = await requestMedusa(fetcher, url, {
        headers: getAdminHeaders(options.adminApiToken),
      });
      if (response.status === 404)
        return { ok: false, error: "catalog_translation_not_found", status: 404 };
      if (!response.ok) return mapFailure(response);
      const data = await response.json().catch(() => undefined);
      const resource = isRecord(data?.shipping_option) ? data.shipping_option : null;
      if (!resource) return { ok: false, error: "catalog_translation_not_found", status: 404 };
      return {
        productId: null,
        source: cleanSource(input.resourceType, resource),
        title: getString(resource.name) ?? "Delivery",
      };
    }

    const isCategory = input.resourceType === "product_category";
    const owned = isCategory
      ? await categoryBelongsToTenantById(fetcher, options, input.resourceId, input.tenantId)
      : await collectionBelongsToTenantById(fetcher, options, input.resourceId, input.tenantId);
    if (typeof owned === "object") return owned;
    if (!owned) return { ok: false, error: "catalog_translation_not_found", status: 404 };

    const path = isCategory
      ? `/admin/product-categories/${encodeURIComponent(input.resourceId)}`
      : `/admin/collections/${encodeURIComponent(input.resourceId)}`;
    const url = new URL(path, normalizeBaseUrl(options.medusaInternalUrl));
    url.searchParams.set("fields", isCategory ? "id,name,description" : "id,title");
    const response = await requestMedusa(fetcher, url, {
      headers: getAdminHeaders(options.adminApiToken),
    });
    if (response.status === 404) {
      return { ok: false, error: "catalog_translation_not_found", status: 404 };
    }
    if (!response.ok) {
      const failure = mapFailure(response);
      return failure.ok ? { ok: false, error: "commerce_backend_error", status: 502 } : failure;
    }
    const data = await response.json().catch(() => undefined);
    const resource = isRecord(isCategory ? data?.product_category : data?.collection)
      ? isCategory
        ? data.product_category
        : data.collection
      : null;
    if (!isRecord(resource)) {
      return { ok: false, error: "catalog_translation_not_found", status: 404 };
    }
    const source = cleanSource(input.resourceType, resource);
    return {
      productId: null,
      source,
      title: getString(resource.name) ?? getString(resource.title) ?? "Catalog item",
    };
  }

  function mapFailure(response: Response): CatalogTranslationReadResult {
    return mapMedusaHttpFailure(response) as CatalogTranslationReadResult;
  }

  async function findTranslation(input: CatalogTranslationResourceInput) {
    const url = new URL("/admin/translations", normalizeBaseUrl(options.medusaInternalUrl));
    url.searchParams.set("reference", input.resourceType);
    url.searchParams.set("reference_id", input.resourceId);
    url.searchParams.set("locale_code", storefrontCommerceLocale(input.locale));
    url.searchParams.set("limit", "1");
    const response = await requestMedusa(fetcher, url, {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    });
    if (!response.ok) return { response } as const;
    const data = await response.json().catch(() => undefined);
    const translation = Array.isArray(data?.translations)
      ? parseTranslation(data.translations[0])
      : null;
    return { translation } as const;
  }

  async function read(
    input: CatalogTranslationResourceInput,
  ): Promise<CatalogTranslationReadResult> {
    const sourceResult = await getSource(input);
    if ("ok" in sourceResult) return sourceResult;
    const found = await findTranslation(input);
    if ("response" in found) return mapFailure(found.response);
    const stored = found.translation?.translations ?? {};
    const translations = Object.fromEntries(
      Object.entries(stored).filter(([field]) => field !== SOURCE_HASH_FIELD),
    );
    const fields = Object.keys(sourceResult.source);
    const translatedFields = fields.filter((field) => translations[field]?.trim()).length;
    const resource: CatalogTranslationResource = {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      productId: sourceResult.productId,
      locale: input.locale,
      title: sourceResult.title,
      source: sourceResult.source,
      translations,
      status: translationStatus(sourceResult.source, stored),
      translatedFields,
      totalFields: fields.length,
    };
    return { ok: true, resource };
  }

  async function write(
    input: CatalogTranslationUpdateInput,
  ): Promise<CatalogTranslationWriteResult> {
    const sourceResult = await getSource(input);
    if ("ok" in sourceResult) return sourceResult;
    const allowed = new Set(Object.keys(sourceResult.source));
    if (Object.keys(input.translations).some((field) => !allowed.has(field))) {
      return { ok: false, error: "catalog_translation_invalid", status: 422 };
    }
    const translations = Object.fromEntries(
      Object.entries(input.translations)
        .map(([field, value]) => [field, value.trim()] as const)
        .filter(([, value]) => value.length > 0),
    );
    const found = await findTranslation(input);
    if ("response" in found) return mapFailure(found.response);
    const payloadTranslations = translations;
    const body = found.translation
      ? { update: [{ id: found.translation.id, translations: payloadTranslations }] }
      : {
          create: [
            {
              reference: input.resourceType,
              reference_id: input.resourceId,
              locale_code: storefrontCommerceLocale(input.locale),
              translations: payloadTranslations,
            },
          ],
        };
    const response = await requestMedusa(
      fetcher,
      new URL("/admin/translations/batch", normalizeBaseUrl(options.medusaInternalUrl)),
      {
        body: JSON.stringify(body),
        headers: getAdminHeaders(options.adminApiToken ?? ""),
        method: "POST",
      },
    );
    if (!response.ok) return mapFailure(response);
    if (sourceResult.productId) {
      // Translation storage is authoritative. Search is an eventually-consistent
      // projection, so a temporary indexing failure must not discard a valid save.
      await requestMedusa(
        fetcher,
        new URL("/admin/product-search", normalizeBaseUrl(options.medusaInternalUrl)),
        {
          body: JSON.stringify({ ids: [sourceResult.productId] }),
          headers: getAdminHeaders(options.adminApiToken ?? ""),
          method: "POST",
        },
      ).catch(() => undefined);
    }
    return read(input);
  }

  async function readiness(
    input: CatalogTranslationQueueInput,
  ): Promise<CatalogTranslationQueueResult> {
    if (!options.adminApiToken?.trim()) return missingCredentials();
    if (input.resourceType === "shipping_option") {
      if (!input.shippingOptionId) {
        return {
          ok: true,
          queue: {
            items: [],
            count: 0,
            ready: 0,
            needsReview: 0,
            usingEnglish: 0,
            limit: input.limit,
            offset: input.offset,
          },
        };
      }
      const result = await read({
        locale: input.locale,
        resourceId: input.shippingOptionId,
        resourceType: "shipping_option",
        salesChannelId: input.salesChannelId,
        shippingOptionId: input.shippingOptionId,
        tenantId: input.tenantId,
      });
      if (!result.ok) return result;
      const item = {
        resourceId: result.resource.resourceId,
        title: result.resource.title,
        status: result.resource.status,
        translatedFields: result.resource.translatedFields,
        totalFields: result.resource.totalFields,
      };
      const matchesQuery =
        !input.q || item.title.toLocaleLowerCase().includes(input.q.toLocaleLowerCase());
      const matchesStatus = !input.status || item.status === input.status;
      const items = matchesQuery && matchesStatus ? [item] : [];
      return {
        ok: true,
        queue: {
          items: items.slice(input.offset, input.offset + input.limit),
          count: items.length,
          ready: matchesQuery && item.status === "ready" ? 1 : 0,
          needsReview: matchesQuery && item.status === "needs_review" ? 1 : 0,
          usingEnglish: matchesQuery && item.status === "using_english" ? 1 : 0,
          limit: input.limit,
          offset: input.offset,
        },
      };
    }
    const url = new URL(
      "/admin/platform-translation-readiness",
      normalizeBaseUrl(options.medusaInternalUrl),
    );
    url.searchParams.set("sales_channel_id", input.salesChannelId);
    url.searchParams.set("tenant_id", input.tenantId);
    url.searchParams.set("locale", storefrontCommerceLocale(input.locale));
    url.searchParams.set("resource_type", input.resourceType);
    if (input.shippingOptionId) url.searchParams.set("shipping_option_id", input.shippingOptionId);
    url.searchParams.set("limit", String(input.limit));
    url.searchParams.set("offset", String(input.offset));
    if (input.status) url.searchParams.set("status", input.status);
    if (input.q) url.searchParams.set("q", input.q);
    const response = await requestMedusa(fetcher, url, {
      headers: getAdminHeaders(options.adminApiToken),
    });
    if (!response.ok) {
      const failure = mapFailure(response);
      return failure.ok ? { ok: false, error: "commerce_backend_error", status: 502 } : failure;
    }
    const parsed = catalogTranslationQueueSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    return parsed.success
      ? { ok: true, queue: parsed.data }
      : { ok: false, error: "commerce_backend_error", status: 502 };
  }

  return { read, readiness, write };
}
