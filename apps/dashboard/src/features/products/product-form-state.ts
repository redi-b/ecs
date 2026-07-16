import type { MerchantProduct } from "@ecs/contracts";
import { z } from "zod";

import { NO_COLLECTION_VALUE } from "@/features/products/product-form-fields";
import {
  type ComposerStep,
  createProductPayloadSchema,
  type ProductFormValues,
} from "@/features/products/product-form-types";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { buildVariantMatrix } from "@/features/products/product-variant-matrix";
import type { MessageKey } from "@/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export function getProductDefaultValues(product: MerchantProduct | undefined): ProductFormValues {
  const firstPrice = getFirstVariantPrice(product);
  const title = product?.title ?? "";
  const generatedHandle = slugifyProductHandle(title);
  const initialOptions = getInitialProductOptions(product);

  return {
    title,
    description: product?.description ?? "",
    handle: product?.handle ?? generatedHandle,
    thumbnail: product?.thumbnail ?? "",
    imageUrls: (product?.images ?? [])
      .map((image) => image.url)
      .filter(Boolean)
      .join("\n"),
    status: normalizeStatus(product?.status),
    priceAmount: firstPrice?.amount === undefined ? "" : String(firstPrice.amount),
    currencyCode: "etb",
    hasVariants: Boolean(product && initialOptions.length),
    initialStock: "0",
    options: initialOptions,
    skuPrefix: getDefaultSkuPrefix(product?.handle ?? title),
    variantOverrides: {},
    collectionId: product?.collectionId ?? NO_COLLECTION_VALUE,
    categoryIds: product?.categoryIds ?? [],
  };
}

export function getProductPayload(
  values: ProductFormValues,
  options: { includeOptions: boolean },
  t: Translate,
) {
  const parsed = createProductPayloadSchema(t).safeParse({
    title: values.title,
    description: getNullableString(values.description),
    handle: getNullableString(values.handle),
    thumbnail: getNullableString(values.thumbnail),
    imageUrls: values.imageUrls
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean),
    status: values.status,
    priceAmount: /^\d+$/.test(values.priceAmount.trim())
      ? Number.parseInt(values.priceAmount.trim(), 10)
      : undefined,
    currencyCode: values.currencyCode,
    options: options.includeOptions ? getProductOptionsPayload(values) : undefined,
    variants: options.includeOptions ? getProductVariantsPayload(values) : undefined,
    collectionId:
      values.collectionId && values.collectionId !== NO_COLLECTION_VALUE
        ? values.collectionId
        : null,
    categoryIds: values.categoryIds,
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? t("products.validation.reviewFields"),
    );
  }

  return parsed.data;
}

export function getProductSuccessPath(action: string, productId: string, isEdit: boolean) {
  const path = isEdit ? `/admin/products/${encodeURIComponent(productId)}` : "/admin/products";

  if (typeof window === "undefined") {
    return path;
  }

  const tenantId = new URL(action, window.location.origin).searchParams.get("tenantId");

  if (!tenantId) {
    return path;
  }

  const url = new URL(path, window.location.origin);

  url.searchParams.set("tenantId", tenantId);

  return `${url.pathname}${url.search}`;
}

export function getFirstInvalidFieldForStep(
  step: ComposerStep["id"],
  values: ProductFormValues,
  t: Translate,
): keyof ProductFormValues | null {
  if (step === "details") {
    if (validateTitle(values.title, t)) {
      return "title";
    }

    if (validateImageUrls(values.imageUrls, t)) {
      return "imageUrls";
    }
  }

  if (step === "variants" && validatePriceAmount(values.priceAmount, t)) {
    return "priceAmount";
  }

  if (step === "variants" && validateInitialStock(values.initialStock, t)) {
    return "initialStock";
  }

  return null;
}

export function getNullableString(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function validateTitle(value: string, t: Translate) {
  return value.trim() ? undefined : t("products.validation.titleRequired");
}

export function validatePriceAmount(value: string, t: Translate) {
  const trimmed = value.trim();

  if (!trimmed) {
    return t("products.validation.priceRequired");
  }

  if (!/^\d+$/.test(trimmed)) {
    return /[a-zA-Z]/.test(trimmed)
      ? t("products.validation.priceNumbersOnly")
      : t("products.validation.priceWholeNumber");
  }

  return undefined;
}

export function getProductOptionsPayload(values: ProductFormValues) {
  if (!values.hasVariants) {
    return [{ title: "Default", values: ["Default"] }];
  }

  const options = normalizeProductOptions(values.options);

  return options.length ? options : undefined;
}

export function getProductVariantsPayload(values: ProductFormValues) {
  if (!values.hasVariants) {
    return [
      {
        optionValues: { Default: "Default" },
        sku: values.skuPrefix.trim() ? values.skuPrefix.trim() : null,
        priceAmount: parseWholeNumber(values.priceAmount) ?? 0,
        currencyCode: values.currencyCode,
        stockedQuantity: parseWholeNumber(values.initialStock) ?? 0,
      },
    ];
  }

  return getVariantRows(values).map((row) => ({
    optionValues: row.optionValues,
    sku: row.sku.trim() ? row.sku.trim() : null,
    priceAmount: row.priceAmount,
    currencyCode: row.currencyCode,
    stockedQuantity: row.stockedQuantity,
  }));
}

export function getVariantRows(values: ProductFormValues) {
  return buildVariantMatrix({
    defaults: {
      currencyCode: values.currencyCode,
      priceAmount: parseWholeNumber(values.priceAmount) ?? 0,
      skuPrefix: values.skuPrefix,
      stockedQuantity: parseWholeNumber(values.initialStock) ?? 0,
    },
    options: normalizeProductOptions(values.options),
    overrides: getVariantOverrideMap(values.variantOverrides),
  });
}

export function getVariantOverrideMap(values: ProductFormValues["variantOverrides"]) {
  return new Map(
    Object.entries(values).map(([key, override]) => [
      key,
      {
        ...(override.priceAmount?.trim()
          ? { priceAmount: parseWholeNumber(override.priceAmount) }
          : {}),
        ...(override.sku?.trim() ? { sku: override.sku.trim() } : {}),
        ...(override.stockedQuantity?.trim()
          ? { stockedQuantity: parseWholeNumber(override.stockedQuantity) }
          : {}),
      },
    ]),
  );
}

export function normalizeProductOptions(options: ProductOptionDraft[]) {
  return options
    .map((option) => ({
      title: option.title.trim(),
      values: [...new Set(option.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((option) => option.title && option.values.length);
}

export function validateInitialStock(value: string, t: Translate) {
  const trimmed = value.trim();

  if (!trimmed) {
    return t("products.validation.stockRequired");
  }

  if (!/^\d+$/.test(trimmed)) {
    return t("products.validation.stockWholeNumber");
  }

  return undefined;
}

export function parseWholeNumber(value: string) {
  const trimmed = value.trim();

  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : undefined;
}

export function formatEtbAmount(value: string, t: Translate) {
  const amount = parseWholeNumber(value);

  return amount === undefined ? t("products.validation.noPrice") : `ETB ${amount}`;
}

export class ProductMutationError extends Error {
  step: ComposerStep["id"] | null;

  constructor(message: string, step: ComposerStep["id"] | null = null) {
    super(message);
    this.name = "ProductMutationError";
    this.step = step;
  }
}

export function getProductMutationError(
  error: string | undefined,
  status: number,
  t: Translate,
) {
  if (error === "product_conflict" || status === 409) {
    return new ProductMutationError(t("products.validation.handleConflict"), "details");
  }

  if (error === "product_write_invalid" || status === 400 || status === 422) {
    return new ProductMutationError(t("products.validation.writeInvalid"), "details");
  }

  if (error === "commerce_backend_unavailable") {
    return new ProductMutationError(t("products.validation.catalogUnavailable"));
  }

  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return new ProductMutationError(t("products.validation.catalogContactSupport"));
  }

  return new ProductMutationError(t("products.validation.saveFailed"));
}

export function getErrorMessage(error: unknown, t: Translate) {
  return error instanceof Error ? error.message : t("products.validation.saveFailed");
}

export function validateImageUrls(value: string, t: Translate) {
  const urls = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  for (const url of urls) {
    if (!z.string().url().safeParse(url).success) {
      return t("products.validation.imageUrlFull");
    }
  }

  return undefined;
}

export function normalizeStatus(status: string | null | undefined): ProductFormValues["status"] {
  return status === "published" ? "published" : "draft";
}

export function getFirstVariantPrice(product: MerchantProduct | undefined) {
  for (const variant of product?.variants ?? []) {
    for (const price of variant.prices) {
      if (price.amount !== null || price.currencyCode) {
        return {
          amount: price.amount === null ? "" : String(price.amount),
        };
      }
    }
  }

  return undefined;
}

export function getInitialProductOptions(
  product: MerchantProduct | undefined,
): ProductOptionDraft[] {
  const options = new Map<string, Set<string>>();

  for (const variant of product?.variants ?? []) {
    for (const option of variant.optionValues ?? []) {
      if (!option.optionTitle || !option.value || option.optionTitle === "Default") {
        continue;
      }

      const values = options.get(option.optionTitle) ?? new Set<string>();
      values.add(option.value);
      options.set(option.optionTitle, values);
    }
  }

  return Array.from(options, ([title, values]) => ({
    title,
    values: Array.from(values),
  }));
}

export function slugifyProductHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getDefaultSkuPrefix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isInitialHandleLocked(product: MerchantProduct | undefined) {
  if (!product?.handle) {
    return true;
  }

  return product.handle === slugifyProductHandle(product.title ?? "");
}
