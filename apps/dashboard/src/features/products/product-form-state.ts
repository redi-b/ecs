import type { MerchantProduct } from "@ecs/contracts";
import { z } from "zod";

import { NO_COLLECTION_VALUE } from "@/features/products/product-form-fields";
import {
  type ComposerStep,
  createProductPayloadSchema,
  type ProductFormValues,
} from "@/features/products/product-form-types";
import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";
import { buildVariantMatrix, getVariantDraftKey } from "@/features/products/product-variant-matrix";
import type { MessageKey } from "@/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export function getProductDefaultValues(product: MerchantProduct | undefined): ProductFormValues {
  const firstPrice = getFirstVariantPrice(product);
  const title = product?.title ?? "";
  const generatedHandle = slugifyProductHandle(title);
  const initialOptions = getInitialProductOptions(product);
  const initialOverrides = getInitialVariantOverrides(product, initialOptions);
  const simpleVariant = initialOptions.length ? undefined : product?.variants?.[0];

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
    initialStock: String(simpleVariant?.stock?.stockedQuantity ?? 0),
    options: initialOptions,
    skuPrefix: product ? (simpleVariant?.sku ?? getDefaultSkuPrefix(product.handle ?? title)) : "",
    variantOverrides: initialOverrides,
    collectionId: product?.collectionId ?? NO_COLLECTION_VALUE,
    categoryIds: product?.categoryIds ?? [],
  };
}

export function getProductPayload(
  values: ProductFormValues,
  options: { includeOptions: boolean },
  t: Translate,
) {
  validateProductVariantConfiguration(values, t);
  const priceError = validatePriceAmount(values.priceAmount, t);
  if (priceError) {
    throw new Error(priceError);
  }

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
    priceAmount: Number.parseInt(values.priceAmount.trim(), 10),
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
      humanizeZodIssue(parsed.error.issues[0], t) ?? t("products.validation.reviewFields"),
    );
  }

  return parsed.data;
}

export function validateProductOptions(
  options: ProductOptionDraft[],
  t: Translate,
): string | undefined {
  if (!options.length) {
    return t("products.validation.optionRequired");
  }

  const optionNames = new Set<string>();
  for (const option of options) {
    const trimmedTitle = option.title.trim();
    if (!trimmedTitle) {
      return t("products.validation.optionNameRequired");
    }

    const lowerName = trimmedTitle.toLocaleLowerCase();
    if (optionNames.has(lowerName)) {
      return t("products.validation.optionNamesUnique");
    }
    optionNames.add(lowerName);

    const validValues = option.values.filter((value) => value.label.trim().length > 0);
    if (!validValues.length) {
      return t("products.validation.optionValueRequired");
    }

    const valueNames = new Set<string>();
    for (const value of validValues) {
      const lowerVal = value.label.trim().toLocaleLowerCase();
      if (valueNames.has(lowerVal)) {
        return t("products.validation.optionValuesUnique", { option: trimmedTitle });
      }
      valueNames.add(lowerVal);
    }
  }

  return undefined;
}

export function validateProductVariantConfiguration(values: ProductFormValues, t: Translate) {
  if (!values.hasVariants) return;

  const optionsError = validateProductOptions(values.options, t);
  if (optionsError) {
    throw new ProductMutationError(optionsError, "variants");
  }

  const rows = getVariantRows(values);
  if (rows.length > 100) {
    throw new ProductMutationError(
      t("products.validation.variantLimit", { count: 100 }),
      "variants",
    );
  }

  if (!rows.some((row) => row.enabled)) {
    throw new ProductMutationError(t("products.validation.variantRequired"), "variants");
  }

  if (getRemovedExistingVariants(values).some((variant) => variant.reservedQuantity > 0)) {
    throw new ProductMutationError(t("products.validation.variantReserved"), "variants");
  }
}

export function getProductSuccessPath(action: string, productId: string, isEdit: boolean) {
  const path = isEdit ? `/dashboard/products/${encodeURIComponent(productId)}` : "/dashboard/products";

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

  if (step === "variants") {
    if (validatePriceAmount(values.priceAmount, t)) {
      return "priceAmount";
    }

    if (validateInitialStock(values.initialStock, t)) {
      return "initialStock";
    }

    if (values.hasVariants && validateProductOptions(values.options, t)) {
      return "options";
    }
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
    return [{ title: "Default", values: [{ label: "Default" }] }];
  }

  const options = normalizeProductOptions(values.options);

  return options.length ? options : undefined;
}

export function getProductVariantsPayload(values: ProductFormValues) {
  if (!values.hasVariants) {
    return [
      {
        ...(values.variantOverrides.default?.id ? { id: values.variantOverrides.default.id } : {}),
        optionValues: { Default: "Default" },
        sku: values.skuPrefix.trim() ? values.skuPrefix.trim() : null,
        priceAmount: parseWholeNumber(values.priceAmount) ?? 0,
        currencyCode: values.currencyCode,
        stockedQuantity: parseWholeNumber(values.initialStock) ?? 0,
      },
    ];
  }

  return getVariantRows(values)
    .filter((row) => row.enabled)
    .map((row) => ({
      ...(row.id ? { id: row.id } : {}),
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
        ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
        ...(override.id?.trim() ? { id: override.id.trim() } : {}),
        ...(override.priceAmount?.trim()
          ? { priceAmount: parseWholeNumber(override.priceAmount) }
          : {}),
        ...(override.sku?.trim() ? { sku: override.sku.trim() } : {}),
        ...(override.stockedQuantity?.trim()
          ? { stockedQuantity: parseWholeNumber(override.stockedQuantity) }
          : {}),
        ...(override.reservedQuantity !== undefined
          ? { reservedQuantity: override.reservedQuantity }
          : {}),
      },
    ]),
  );
}

export function normalizeProductOptions(options: ProductOptionDraft[]) {
  return options
    .map((option) => ({
      ...(option.id ? { id: option.id } : {}),
      ...(option.key ? { key: option.key } : {}),
      title: option.title.trim(),
      values: option.values
        .map((value) => ({
          ...(value.id ? { id: value.id } : {}),
          ...(value.key ? { key: value.key } : {}),
          label: value.label.trim(),
          ...(value.swatch !== undefined ? { swatch: value.swatch } : {}),
        }))
        .filter((value) => value.label),
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
  code: string | null;

  constructor(message: string, step: ComposerStep["id"] | null = null, code: string | null = null) {
    super(message);
    this.name = "ProductMutationError";
    this.step = step;
    this.code = code;
  }
}

export function suggestAvailableProductHandle(handle: string, usedHandles: Iterable<string> = []) {
  const normalized = slugifyProductHandle(handle) || "product";
  const numbered = normalized.match(/^(.*?)-(\d+)$/);
  const base = numbered?.[1] || normalized;
  let suffix = numbered ? Number.parseInt(numbered[2] ?? "1", 10) + 1 : 2;
  const used = new Set(Array.from(usedHandles, (value) => value.trim().toLowerCase()));
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function getProductMutationError(error: string | undefined, status: number, t: Translate) {
  if (error === "product_conflict" || status === 409) {
    return new ProductMutationError(
      t("products.validation.handleConflict"),
      "details",
      "product_conflict",
    );
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

/** Map raw Zod type errors to product form copy when schema messages are missing. */
function humanizeZodIssue(
  issue: { message?: string; path?: PropertyKey[]; code?: string } | undefined,
  t: Translate,
) {
  if (!issue) return undefined;

  const path = issue.path?.map(String).join(".") ?? "";
  if (path === "priceAmount" || path.endsWith(".priceAmount")) {
    return t("products.validation.priceRequired");
  }
  if (path === "stockedQuantity" || path.endsWith(".stockedQuantity")) {
    return t("products.validation.stockRequired");
  }
  if (path === "title") {
    return t("products.validation.titleRequired");
  }

  // Drop unhelpful Zod default type messages in the composer footer.
  if (
    issue.message?.startsWith("Invalid input:") ||
    issue.message?.includes("expected number") ||
    issue.message?.includes("expected string")
  ) {
    return t("products.validation.reviewFields");
  }

  return issue.message;
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
  if (product?.options?.length) {
    return product.options
      .filter((option) => option.title !== "Default")
      .map((option) => ({
        ...(option.id ? { id: option.id } : {}),
        key: option.id ?? `option:${option.title.toLocaleLowerCase()}`,
        title: option.title,
        values: option.values.map((value, valueIndex) => ({
          ...(value.id ? { id: value.id } : {}),
          key:
            value.id ??
            `value:${option.title.toLocaleLowerCase()}:${value.label.toLocaleLowerCase()}:${valueIndex}`,
          label: value.label,
          ...(value.swatch
            ? { swatch: { kind: "color" as const, value: value.swatch.value } }
            : {}),
        })),
      }));
  }

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

  return Array.from(options, ([title, values], optionIndex) => ({
    key: `option:${title.toLocaleLowerCase()}:${optionIndex}`,
    title,
    values: Array.from(values, (label, valueIndex) => ({
      key: `value:${title.toLocaleLowerCase()}:${label.toLocaleLowerCase()}:${valueIndex}`,
      label,
    })),
  }));
}

export function getInitialVariantOverrides(
  product: MerchantProduct | undefined,
  options: ProductOptionDraft[],
): ProductFormValues["variantOverrides"] {
  const overrides: ProductFormValues["variantOverrides"] = {};

  for (const variant of product?.variants ?? []) {
    const optionValues = Object.fromEntries(
      (variant.optionValues ?? []).flatMap((entry) =>
        entry.optionTitle && entry.value ? [[entry.optionTitle, entry.value]] : [],
      ),
    );
    const selections = options.flatMap((option) => {
      const label = optionValues[option.title];
      const value = option.values.find((candidate) => candidate.label === label);
      return value ? [{ option, value }] : [];
    });
    const key =
      selections.length === options.length
        ? getVariantDraftKey(selections)
        : options.length
          ? `unmatched:${variant.id}`
          : "default";
    const price =
      variant.prices.find((candidate) => candidate.currencyCode?.toLocaleLowerCase() === "etb") ??
      variant.prices[0];

    overrides[key] = {
      enabled: true,
      id: variant.id,
      ...(price?.amount !== null && price?.amount !== undefined
        ? { priceAmount: String(price.amount) }
        : {}),
      reservedQuantity: variant.stock?.reservedQuantity ?? 0,
      ...(variant.sku ? { sku: variant.sku } : {}),
      stockedQuantity: String(variant.stock?.stockedQuantity ?? 0),
    };
  }

  return overrides;
}

export function getRemovedExistingVariants(values: ProductFormValues) {
  const retainedIds = new Set(
    getVariantRows(values)
      .filter((row) => row.enabled && row.id)
      .map((row) => row.id),
  );

  return Object.entries(values.variantOverrides).flatMap(([key, override]) =>
    override.id && !retainedIds.has(override.id)
      ? [{ id: override.id, key, reservedQuantity: override.reservedQuantity ?? 0 }]
      : [],
  );
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

export function getMediaUrls(thumbnail: string, imageUrls: string) {
  return Array.from(
    new Set([thumbnail, ...imageUrls.split(/\r?\n/)].map((url) => url.trim()).filter(Boolean)),
  );
}
