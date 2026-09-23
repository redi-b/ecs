import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
  MerchantProductStock,
} from "../../../types/index.js";
import {
  PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY,
  productOptionMediaBindingsSchema,
  type ProductOptionMediaBindings,
  type ProductOptionSwatchWithSource,
} from "@ecs/contracts";
import { getBoolean, getNumber, getString, isRecord } from "./values.js";
import { getPublicProductHandle } from "./handles.js";

export function normalizeProduct(value: unknown): MerchantProduct[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  const images = getProductImages(value.images);
  const options = getProductOptions(value.options);
  const optionMediaBindings = getProductOptionMediaBindings(value.metadata);
  const mediaMetadata = getProductMediaMetadata(value.metadata);

  return [
    {
      id,
      categoryIds: getProductCategoryIds(value.categories),
      collectionId: getString(value.collection_id),
      description: getString(value.description),
      title: getString(value.title),
      handle: getPublicProductHandle({
        handle: getString(value.handle),
        metadata: value.metadata,
      }),
      status: getString(value.status),
      thumbnail: getString(value.thumbnail),
      ...(images.length === 0 ? {} : { images }),
      ...(options === undefined ? {} : { options }),
      ...(optionMediaBindings !== undefined ? { optionMediaBindings } : {}),
      ...(Object.keys(mediaMetadata).length ? { metadata: mediaMetadata } : {}),
      variants: getProductVariants(value.variants),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

export function getProductOptionMediaBindings(
  metadata: unknown,
): ProductOptionMediaBindings | null | undefined {
  if (!isRecord(metadata)) return undefined;
  let raw = metadata.option_media_bindings;
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  const parsed = productOptionMediaBindingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function getProductOptions(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((option) => {
    if (!isRecord(option)) return [];
    const title = getString(option.title);
    if (!title) return [];

    return [
      {
        id: getString(option.id),
        title,
        values: Array.isArray(option.values)
          ? option.values.flatMap((optionValue) => {
              if (!isRecord(optionValue)) return [];
              const label = getString(optionValue.value);
              if (!label) return [];
              const swatch = getExplicitSwatch(optionValue.metadata);
              return [
                {
                  id: getString(optionValue.id),
                  label,
                  ...(swatch ? { swatch } : {}),
                },
              ];
            })
          : [],
      },
    ];
  });
}

export function getExplicitSwatch(metadata: unknown): ProductOptionSwatchWithSource | undefined {
  if (!isRecord(metadata)) return undefined;
  const presentation = metadata[PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY];
  if (!isRecord(presentation) || presentation.version !== 1) return undefined;
  const swatch = presentation.swatch;
  if (!isRecord(swatch)) return undefined;

  if (swatch.kind === "color") {
    const value = getString(swatch.value)?.toLowerCase();
    if (!value || !/^#[0-9a-f]{6}$/.test(value)) return undefined;
    return { kind: "color" as const, value, source: "explicit" as const };
  }

  if (swatch.kind === "image") {
    const url = getString(swatch.url);
    if (!url) return undefined;
    try {
      new URL(url);
      return { kind: "image" as const, url, source: "explicit" as const };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export const getExplicitColorSwatch = getExplicitSwatch;

export function getProductCategoryIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((category) => (isRecord(category) ? getString(category.id) : null))
    .filter((id): id is string => Boolean(id));
}

export function getProductImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((image) => {
    if (!isRecord(image)) {
      return [];
    }

    const id = getString(image.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        url: getString(image.url),
        rank: getNumber(image.rank) ?? null,
        createdAt: getString(image.created_at),
        updatedAt: getString(image.updated_at),
      },
    ];
  });
}

export function getProductVariants(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((variant) => {
    if (!isRecord(variant)) {
      return [];
    }

    const id = getString(variant.id);

    if (!id) {
      return [];
    }

    const optionValues = getProductVariantOptionValues(variant.options);
    const imageUrl = getVariantImageUrl(variant);

    return [
      {
        id,
        inventoryItemId: getVariantInventoryItemId(variant),
        ...(typeof variant.manage_inventory === "boolean"
          ? { manageInventory: variant.manage_inventory }
          : {}),
        ...(typeof variant.allow_backorder === "boolean"
          ? { allowBackorder: variant.allow_backorder }
          : {}),
        title: getString(variant.title),
        sku: getString(variant.sku),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(isRecord(variant.metadata) &&
        (variant.metadata.image_source === "option" || variant.metadata.image_source === "manual")
          ? { imageSource: variant.metadata.image_source as "option" | "manual" }
          : {}),
        ...(optionValues.length === 0 ? {} : { optionValues }),
        prices: getProductPrices(variant.prices),
      },
    ];
  });
}

export function getVariantImageUrl(variant: Record<string, unknown>): string | null | undefined {
  const metadata = isRecord(variant.metadata) ? variant.metadata : undefined;
  const raw =
    metadata?.image_url !== undefined
      ? metadata.image_url
      : variant.image_url !== undefined
        ? variant.image_url
        : variant.imageUrl !== undefined
          ? variant.imageUrl
          : variant.thumbnail;

  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const str = getString(raw);
  if (!str) return null;
  return str;
}

export function getProductVariantOptionValues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((optionValue) => {
    if (!isRecord(optionValue)) {
      return [];
    }

    const value = getString(optionValue.value);
    const optionTitle = isRecord(optionValue.option)
      ? getString(optionValue.option.title)
      : getString(optionValue.option_title);

    if (!value && !optionTitle) {
      return [];
    }

    return [
      {
        optionTitle,
        value,
      },
    ];
  });
}

export function getSingleVariantInventoryItem(product: unknown) {
  if (!isRecord(product) || !Array.isArray(product.variants)) {
    return undefined;
  }

  const variants = product.variants.filter(isRecord);

  if (variants.length !== 1) {
    return variants.length > 1 ? "multiple_variants" : undefined;
  }

  const variant = variants[0];

  if (!variant) {
    return undefined;
  }

  const variantId = getString(variant.id);
  const inventoryItemId = getVariantInventoryItemId(variant);

  if (variantId && inventoryItemId) {
    return {
      variantId,
      inventoryItemId,
    };
  }

  return undefined;
}

export function getVariantInventoryItem(product: unknown, variantId: string) {
  if (!isRecord(product) || !Array.isArray(product.variants)) {
    return undefined;
  }

  const variant = product.variants
    .filter(isRecord)
    .find((candidate) => getString(candidate.id) === variantId);

  if (!variant) {
    return undefined;
  }

  const inventoryItemId = getVariantInventoryItemId(variant);

  if (!inventoryItemId) {
    return undefined;
  }

  return {
    variantId,
    inventoryItemId,
  };
}

export function getVariantInventoryItemId(variant: Record<string, unknown>) {
  if (!Array.isArray(variant.inventory_items)) {
    return null;
  }

  for (const inventoryItem of variant.inventory_items) {
    if (!isRecord(inventoryItem)) {
      continue;
    }

    const inventoryItemId =
      getString(inventoryItem.inventory_item_id) ?? getString(inventoryItem.id);

    if (inventoryItemId) {
      return inventoryItemId;
    }
  }

  return null;
}

export function normalizeProductStock(input: {
  inventoryItemId: string;
  productId: string;
  stockLocationId: string;
  value: unknown;
  variantId: string;
}): MerchantProductStock | undefined {
  if (!isRecord(input.value) || !Array.isArray(input.value.location_levels)) {
    return undefined;
  }

  const level = input.value.location_levels.find(
    (candidate) => isRecord(candidate) && candidate.location_id === input.stockLocationId,
  );

  if (!isRecord(level)) {
    return undefined;
  }

  return {
    productId: input.productId,
    variantId: input.variantId,
    inventoryItemId: input.inventoryItemId,
    locationId: input.stockLocationId,
    stockedQuantity: getNumber(level.stocked_quantity) ?? null,
    reservedQuantity: getNumber(level.reserved_quantity) ?? null,
    incomingQuantity: getNumber(level.incoming_quantity) ?? null,
    availableQuantity: getNumber(level.available_quantity) ?? null,
  };
}

export function getProductPrices(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((price) => {
    if (!isRecord(price)) {
      return [];
    }

    return [
      {
        amount: getNumber(price.amount) ?? null,
        currencyCode: getString(price.currency_code),
      },
    ];
  });
}

export function normalizeProductCategory(value: unknown): MerchantProductCategory[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  return [
    {
      id,
      name: getString(value.name),
      handle: getString(value.handle),
      isActive: getBoolean(value.is_active),
      isInternal: getBoolean(value.is_internal),
      parentCategoryId: getString(value.parent_category_id),
      rank: getNumber(value.rank) ?? null,
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
      ...(metadata.visibility
        ? { visibility: metadata.visibility === "hidden" ? "hidden" : "public" }
        : {}),
      ...(getString(metadata.seo_title) ? { seoTitle: getString(metadata.seo_title) } : {}),
      ...(getString(metadata.seo_description)
        ? { seoDescription: getString(metadata.seo_description) }
        : {}),
      ...(getString(metadata.media_url) ? { mediaUrl: getString(metadata.media_url) } : {}),
    },
  ];
}

export function normalizeProductCollection(value: unknown): MerchantProductCollection[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  return [
    {
      id,
      title: getString(value.title),
      handle: getString(value.handle),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
      ...(metadata.visibility
        ? { visibility: metadata.visibility === "hidden" ? "hidden" : "public" }
        : {}),
      ...(getString(metadata.seo_title) ? { seoTitle: getString(metadata.seo_title) } : {}),
      ...(getString(metadata.seo_description)
        ? { seoDescription: getString(metadata.seo_description) }
        : {}),
      ...(getString(metadata.media_url) ? { mediaUrl: getString(metadata.media_url) } : {}),
    },
  ];
}

export function belongsToTenant(value: unknown, tenantId: string) {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    return false;
  }

  return value.metadata.platform_tenant_id === tenantId;
}

export function getTenantMetadata(tenantId: string) {
  return {
    platform_tenant_id: tenantId,
  };
}

/** Expose only media presentation data needed by dashboard consumers. */
function getProductMediaMetadata(metadata: unknown): Record<string, unknown> {
  if (!isRecord(metadata) || !isRecord(metadata.media_variants)) return {};
  const variants: Record<string, Record<string, string>> = {};
  for (const [original, value] of Object.entries(metadata.media_variants)) {
    if (!isRecord(value)) continue;
    const sizes = Object.fromEntries(
      ["w200", "w400", "w800", "w1200"].flatMap((key) => {
        const url = getString(value[key]);
        return url && /^https?:\/\//.test(url) ? [[key, url]] : [];
      }),
    );
    if (Object.keys(sizes).length) variants[original] = sizes;
  }
  return { media_variants: variants };
}
