import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionWriteResult,
  MerchantProductWriteResult,
} from "../../../types/index.js";
import {
  normalizeProduct,
  normalizeProductCategory,
  normalizeProductCollection,
} from "./normalize.js";
import type { ProductOptionInput, ProductVariantWriteInput, ProductWriteInput } from "./types.js";
import { getBoolean, getErrorMessage, getString, isRecord } from "./values.js";

export function getProductWriteBody(input: ProductWriteInput) {
  const body = Object.fromEntries(
    [
      ["title", input.title],
      ["description", input.description],
      ["handle", input.handle],
      ["collection_id", input.collectionId],
      ["shipping_profile_id", input.shippingProfileId],
      ["status", input.status],
      ["thumbnail", input.thumbnail],
    ].filter(([, value]) => typeof value === "string" && value.trim()),
  );

  if (input.categoryIds?.length) {
    body.categories = input.categoryIds.map((id) => ({ id }));
  }

  if (input.imageUrls?.length) {
    body.images = input.imageUrls.map((url) => ({ url }));
  }

  if (input.priceAmount !== undefined) {
    const productOptions = getProductOptionsForWrite(input.options);
    const productVariants = getProductVariantsForWrite(input.variants);

    body.options = productOptions;
    body.variants = productVariants.length
      ? productVariants.map((variant) => getProductVariantWriteBody(variant, input.regionId))
      : getProductVariantCombinations(productOptions).map((combination) =>
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

export function getProductOptionsForWrite(options: ProductOptionInput[] | undefined) {
  const normalized = (options ?? [])
    .map((option) => ({
      title: option.title.trim(),
      values: [...new Set(option.values.map((value) => value.trim()).filter(Boolean))],
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

export function getProductVariantsForWrite(variants: ProductVariantWriteInput[] | undefined) {
  return (variants ?? []).filter(
    (variant) =>
      Number.isFinite(variant.priceAmount) &&
      Object.keys(variant.optionValues).length > 0 &&
      variant.currencyCode.trim(),
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

  return {
    title: Object.values(optionValues).join(" / ") || "Default",
    ...(variant.sku?.trim() ? { sku: variant.sku.trim() } : {}),
    manage_inventory: true,
    options: optionValues,
    prices: [
      {
        amount: variant.priceAmount,
        currency_code: variant.currencyCode.trim().toLowerCase(),
        ...(regionId?.trim()
          ? {
              rules: {
                region_id: regionId,
              },
            }
          : {}),
      },
    ],
  };
}

export function getProductVariantCombinations(options: ProductOptionInput[]) {
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

export function getWriteError(response: Response): MerchantProductWriteResult {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
    };
  }

  if (response.status === 409) {
    return {
      ok: false,
      error: "product_conflict",
      status: 409,
    };
  }

  if (response.status === 400 || response.status === 422) {
    return {
      ok: false,
      error: "product_write_invalid",
      status: response.status,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

export function getCategoryWriteError(response: Response): MerchantProductCategoryWriteResult {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

export function getCollectionWriteError(response: Response): MerchantProductCollectionWriteResult {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

export function getDeleteError(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Extract<MerchantDeleteResult, { ok: false }> {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `${resourceName}_not_found` as const,
      status: 404,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

export async function parseDeleteResponse(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Promise<MerchantDeleteResult> {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `${resourceName}_not_found` as const,
      status: 404,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
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
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
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
