import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
  MerchantProductStock,
} from "../../../types/index.js";
import { PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY } from "@ecs/contracts";
import { getBoolean, getNumber, getString, isRecord } from "./values.js";

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

  return [
    {
      id,
      categoryIds: getProductCategoryIds(value.categories),
      collectionId: getString(value.collection_id),
      description: getString(value.description),
      title: getString(value.title),
      handle: getString(value.handle),
      status: getString(value.status),
      thumbnail: getString(value.thumbnail),
      ...(images.length === 0 ? {} : { images }),
      ...(options === undefined ? {} : { options }),
      variants: getProductVariants(value.variants),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
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
              const swatch = getExplicitColorSwatch(optionValue.metadata);
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

function getExplicitColorSwatch(metadata: unknown) {
  if (!isRecord(metadata)) return undefined;
  const presentation = metadata[PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY];
  if (!isRecord(presentation) || presentation.version !== 1) return undefined;
  const swatch = presentation.swatch;
  if (!isRecord(swatch) || swatch.kind !== "color") return undefined;
  const value = getString(swatch.value)?.toLowerCase();
  if (!value || !/^#[0-9a-f]{6}$/.test(value)) return undefined;
  return { kind: "color" as const, value, source: "explicit" as const };
}

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

    return [
      {
        id,
        inventoryItemId: getVariantInventoryItemId(variant),
        title: getString(variant.title),
        sku: getString(variant.sku),
        ...(optionValues.length === 0 ? {} : { optionValues }),
        prices: getProductPrices(variant.prices),
      },
    ];
  });
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
