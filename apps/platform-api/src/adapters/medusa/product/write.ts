import { sanitizeProductDescription } from "@ecs/content";
import { PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY } from "@ecs/contracts";
import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionWriteResult,
  MerchantProductWriteResult,
} from "../../../types/index.js";
import { mapMedusaFailure, mapMedusaHttpFailure } from "../map-medusa-failure.js";
import { getTenantProductHandle, getTenantProductMetadata } from "./handles.js";
import {
  normalizeProduct,
  normalizeProductCategory,
  normalizeProductCollection,
} from "./normalize.js";
import type {
  ProductOptionInput,
  ProductUpdateInput,
  ProductVariantWriteInput,
  ProductWriteInput,
} from "./types.js";
import { getBoolean, getString, isRecord } from "./values.js";

export function getProductWriteBody(input: ProductWriteInput | ProductUpdateInput) {
  const publicHandle = input.handle;
  const storedHandle =
    input.tenantId?.trim() && publicHandle?.trim()
      ? getTenantProductHandle(input.tenantId, publicHandle)
      : publicHandle;
  const body: Record<string, unknown> = Object.fromEntries(
    [
      ["title", input.title],
      [
        "description",
        input.description === undefined ? undefined : sanitizeProductDescription(input.description),
      ],
      ["handle", storedHandle],
      ["collection_id", input.collectionId],
      ["shipping_profile_id", input.shippingProfileId],
      ["status", input.status],
      ["thumbnail", input.thumbnail],
    ].filter(([, value]) => typeof value === "string" && value.trim()),
  );

  if (input.description === null) {
    body.description = null;
  }

  if (input.categoryIds?.length) {
    body.categories = input.categoryIds.map((id) => ({ id }));
  }

  if (input.imageUrls?.length) {
    body.images = input.imageUrls.map((url) => ({ url }));
  }

  const metadata = input.tenantId?.trim()
    ? getTenantProductMetadata(input.tenantId, publicHandle, input.metadata)
    : input.metadata;
  if (metadata && Object.keys(metadata).length > 0) {
    body.metadata = metadata;
  }

  const optionValuePresentations = getOptionValuePresentationsForWrite(input.options);
  if (optionValuePresentations.length) {
    body.additional_data = {
      [PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY]: {
        version: 1,
        values: optionValuePresentations,
      },
    };
  }

  const hasExplicitOptions = input.options !== undefined;
  const isUpdate = "productId" in input;
  const productOptions = getProductOptionsForWrite(input.options);
  const productVariants = getProductVariantsForWrite(input.variants);

  if (!isUpdate && (hasExplicitOptions || input.priceAmount !== undefined)) {
    body.options = productOptions;
  }

  if (productVariants.length) {
    body.variants = productVariants.map((variant) =>
      getProductVariantWriteBody(variant, input.regionId),
    );
  } else if (input.priceAmount !== undefined && !isUpdate) {
    body.variants = getProductVariantCombinations(productOptions).map((combination) =>
      getProductVariantWriteBody(
        {
          optionValues: Object.fromEntries(
            combination.map((option) => [option.title, option.value]),
          ),
          priceAmount: input.priceAmount ?? 0,
          currencyCode: input.currencyCode?.trim().toLowerCase() || "etb",
        },
        input.regionId,
      ),
    );
  }

  return body;
}

type ProductOptionBatchBody = {
  add?: Array<{ title: string; values: string[] }>;
  remove?: string[];
  update?: Array<{ product_option_id: string; add?: string[]; remove?: string[] }>;
};

/** Build the Medusa 2.16+ product-option batch mutation from the editor's desired state. */
export function getProductOptionBatchBody(
  product: unknown,
  desiredOptions: ProductOptionInput[] | undefined,
): ProductOptionBatchBody | null {
  if (desiredOptions === undefined) return null;

  const existingOptions = getExistingProductOptions(product);
  const existingById = new Map(existingOptions.map((option) => [option.id, option]));
  const retainedIds = new Set(
    desiredOptions.flatMap((option) => (option.id?.trim() ? [option.id.trim()] : [])),
  );
  const add: Array<{ title: string; values: string[] }> = [];
  const remove = existingOptions
    .filter((option) => !retainedIds.has(option.id))
    .map((option) => option.id);
  const update: NonNullable<ProductOptionBatchBody["update"]> = [];

  for (const desired of desiredOptions) {
    const title = desired.title.trim();
    const values = desired.values.map(getOptionValueLabel).filter(Boolean);
    const existing = desired.id?.trim() ? existingById.get(desired.id.trim()) : undefined;

    if (!existing) {
      if (title && values.length) add.push({ title, values: [...new Set(values)] });
      continue;
    }

    if (existing.title !== title) {
      if (!remove.includes(existing.id)) remove.push(existing.id);
      if (title && values.length) add.push({ title, values: [...new Set(values)] });
      continue;
    }

    const desiredValueIds = new Set(
      desired.values.flatMap((value) =>
        typeof value !== "string" && value.id?.trim() ? [value.id.trim()] : [],
      ),
    );
    const existingByLabel = new Map(existing.values.map((value) => [value.label, value]));
    const addValues: string[] = [];
    const removeValues: string[] = [];

    for (const desiredValue of desired.values) {
      const label = getOptionValueLabel(desiredValue);
      const id = typeof desiredValue === "string" ? undefined : desiredValue.id?.trim();
      const existingValue = id
        ? existing.values.find((value) => value.id === id)
        : existingByLabel.get(label);

      if (!existingValue) {
        addValues.push(label);
      } else if (existingValue.label !== label) {
        removeValues.push(existingValue.id);
        addValues.push(label);
      }
    }

    for (const existingValue of existing.values) {
      const retainedByLabel = values.includes(existingValue.label);
      if (!desiredValueIds.has(existingValue.id) && !retainedByLabel) {
        removeValues.push(existingValue.id);
      }
    }

    const uniqueAdd = [...new Set(addValues.filter(Boolean))];
    const uniqueRemove = [...new Set(removeValues.filter(Boolean))];
    if (uniqueAdd.length || uniqueRemove.length) {
      update.push({
        product_option_id: existing.id,
        ...(uniqueAdd.length ? { add: uniqueAdd } : {}),
        ...(uniqueRemove.length ? { remove: uniqueRemove } : {}),
      });
    }
  }

  if (!add.length && !remove.length && !update.length) return null;
  return {
    ...(add.length ? { add } : {}),
    ...(remove.length ? { remove: [...new Set(remove)] } : {}),
    ...(update.length ? { update } : {}),
  };
}

function getExistingProductOptions(product: unknown) {
  if (!isRecord(product) || !Array.isArray(product.options)) return [];
  return product.options.flatMap((option) => {
    if (!isRecord(option)) return [];
    const id = getString(option.id);
    const title = getString(option.title);
    if (!id || !title) return [];
    const values = Array.isArray(option.values)
      ? option.values.flatMap((value) => {
          if (!isRecord(value)) return [];
          const valueId = getString(value.id);
          const label = getString(value.value);
          return valueId && label ? [{ id: valueId, label }] : [];
        })
      : [];
    return [{ id, title, values }];
  });
}

export function getProductOptionsForWrite(options: ProductOptionInput[] | undefined) {
  const normalized = (options ?? [])
    .map((option) => ({
      ...(option.id?.trim() ? { id: option.id.trim() } : {}),
      title: option.title.trim(),
      values: [...new Set(option.values.map(getOptionValueLabel).filter(Boolean))],
    }))
    .filter((option) => option.title && option.values.length);

  return normalized.length
    ? normalized
    : [
        {
          title: "Default",
          values: ["Default"],
        },
      ];
}

export function getOptionValuePresentationsForWrite(options: ProductOptionInput[] | undefined) {
  return (options ?? []).flatMap((option) =>
    option.values.flatMap((value) => {
      if (typeof value === "string") return [];
      if (value.swatch === undefined) return [];
      return [
        {
          ...(option.id?.trim() ? { optionId: option.id.trim() } : {}),
          optionTitle: option.title.trim(),
          ...(value.id?.trim() ? { valueId: value.id.trim() } : {}),
          valueLabel: value.label.trim(),
          swatch: value.swatch
            ? {
                kind: "color" as const,
                value: value.swatch.value.toLowerCase(),
              }
            : null,
        },
      ];
    }),
  );
}

function getOptionValueLabel(value: ProductOptionInput["values"][number]) {
  return (typeof value === "string" ? value : value.label).trim();
}

export function getProductVariantsForWrite(variants: ProductVariantWriteInput[] | undefined) {
  return (variants ?? []).filter(
    (variant) =>
      (Number.isFinite(variant.priceAmount) ||
        variant.prices?.some(
          (price) => Number.isFinite(price.amount) && Boolean(price.currencyCode.trim()),
        )) &&
      Object.keys(variant.optionValues).length > 0 &&
      (variant.currencyCode.trim() || variant.prices?.some((price) => price.currencyCode.trim())),
  );
}

export function getProductVariantWriteBody(
  variant: ProductVariantWriteInput,
  regionId: string | null | undefined,
) {
  const optionValues = Object.fromEntries(
    Object.entries(variant.optionValues)
      .map(([title, value]) => [title.trim(), value.trim()])
      .filter(([title, value]) => title && value),
  );

  const prices = variant.prices?.length
    ? variant.prices
    : [
        {
          amount: variant.priceAmount ?? 0,
          currencyCode: variant.currencyCode,
        },
      ];

  return {
    ...(variant.id?.trim() ? { id: variant.id.trim() } : {}),
    title: Object.values(optionValues).join(" / ") || "Default",
    ...(variant.sku?.trim() ? { sku: variant.sku.trim() } : {}),
    manage_inventory: true,
    options: optionValues,
    prices: prices.map((price) => ({
      amount: price.amount,
      currency_code: price.currencyCode.trim().toLowerCase(),
      ...(regionId?.trim()
        ? {
            rules: {
              region_id: regionId,
            },
          }
        : {}),
    })),
  };
}

export function getProductVariantCombinations(options: Array<{ title: string; values: string[] }>) {
  return options.reduce<Array<Array<{ title: string; value: string }>>>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => [...combination, { title: option.title, value }]),
      ),
    [[]],
  );
}

export async function parseProductWriteResponse(
  response: Response,
): Promise<MerchantProductWriteResult> {
  if (!response.ok) {
    return getWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const product = normalizeProduct(data?.product)[0];

  if (!product) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    product,
  };
}

export async function parseProductCategoryWriteResponse(
  response: Response,
): Promise<MerchantProductCategoryWriteResult> {
  if (!response.ok) {
    return getCategoryWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const category = normalizeProductCategory(data?.product_category)[0];

  if (!category) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    category,
  };
}

export async function parseProductCollectionWriteResponse(
  response: Response,
): Promise<MerchantProductCollectionWriteResult> {
  if (!response.ok) {
    return getCollectionWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const collection = normalizeProductCollection(data?.collection)[0];

  if (!collection) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    collection,
  };
}

export async function getWriteError(response: Response): Promise<MerchantProductWriteResult> {
  return (await mapMedusaFailure(response, {
    conflictError: "product_conflict",
    invalidError: "product_write_invalid",
    notFoundError: "product_not_found",
    refine: ({ blob }) =>
      blob.includes("handle") && blob.includes("already exists")
        ? { error: "product_conflict", status: 409 }
        : null,
  })) as Extract<MerchantProductWriteResult, { ok: false }>;
}

export function getCategoryWriteError(response: Response): MerchantProductCategoryWriteResult {
  return mapMedusaHttpFailure(response, {
    conflictError: "category_conflict",
    invalidError: "category_write_invalid",
    notFoundError: "category_not_found",
  }) as Extract<MerchantProductCategoryWriteResult, { ok: false }>;
}

export function getCollectionWriteError(response: Response): MerchantProductCollectionWriteResult {
  return mapMedusaHttpFailure(response, {
    conflictError: "collection_conflict",
    invalidError: "collection_write_invalid",
    notFoundError: "collection_not_found",
  }) as Extract<MerchantProductCollectionWriteResult, { ok: false }>;
}

export function getDeleteError(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Extract<MerchantDeleteResult, { ok: false }> {
  return mapMedusaHttpFailure(response, {
    invalidError: `${resourceName}_write_invalid`,
    notFoundError: `${resourceName}_not_found`,
  }) as Extract<MerchantDeleteResult, { ok: false }>;
}

export async function parseDeleteResponse(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Promise<MerchantDeleteResult> {
  if (!response.ok) {
    return getDeleteError(response, resourceName);
  }

  const data = await response.json().catch(() => undefined);
  const id = getString(data?.id);
  const deleted = getBoolean(data?.deleted) ?? false;

  if (!id) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    id,
    deleted,
  };
}

export async function parseBatchDeleteResponse(
  response: Response,
  requestedIds: string[],
): Promise<MerchantBatchDeleteResult> {
  if (!response.ok) {
    return mapMedusaHttpFailure(response, {
      invalidError: "product_write_invalid",
      notFoundError: "product_not_found",
    }) as Extract<MerchantBatchDeleteResult, { ok: false }>;
  }

  const data = await response.json().catch(() => undefined);
  const deletedIds = Array.isArray(data?.deleted)
    ? data.deleted.filter((id: unknown): id is string => typeof id === "string")
    : requestedIds;

  return {
    ok: true,
    ids: deletedIds,
    deleted: true,
  };
}
