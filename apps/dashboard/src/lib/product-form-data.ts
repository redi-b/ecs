import type { MerchantProductWriteInput } from "./merchant-products";

export function getProductFormInput(formData: FormData): MerchantProductWriteInput {
  const variants = getProductVariants(formData);

  return {
    title: getOptionalString(formData, "title"),
    description: getOptionalString(formData, "description"),
    handle: getOptionalString(formData, "handle"),
    collectionId: getOptionalString(formData, "collectionId"),
    categoryIds: getStringList(formData, "categoryIds"),
    imageUrls: getImageUrls(formData),
    options: getProductOptions(formData),
    ...(variants ? { variants } : {}),
    priceAmount: getPriceAmount(formData),
    currencyCode: getOptionalString(formData, "currencyCode"),
    status: getOptionalString(formData, "status"),
    thumbnail: getOptionalString(formData, "thumbnail"),
  };
}

function getProductOptions(formData: FormData) {
  const jsonOptions = getJsonArray(formData, "options")
    .map((option) => ({
      title: isRecord(option) && typeof option.title === "string" ? option.title.trim() : "",
      values:
        isRecord(option) && Array.isArray(option.values)
          ? option.values
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
    }))
    .filter((option) => option.title && option.values.length);

  if (jsonOptions.length) {
    return jsonOptions;
  }

  const title = getOptionalString(formData, "optionTitle");
  const values = getOptionValues(formData);

  return title && values.length ? [{ title, values }] : undefined;
}

function getProductVariants(formData: FormData) {
  const variants = getJsonArray(formData, "variants")
    .map((variant) => {
      if (!isRecord(variant)) {
        return null;
      }

      const priceAmount =
        typeof variant.priceAmount === "number" ? variant.priceAmount : Number.NaN;
      const currencyCode =
        typeof variant.currencyCode === "string" ? variant.currencyCode.trim() : "";
      const stockedQuantity =
        typeof variant.stockedQuantity === "number" && Number.isInteger(variant.stockedQuantity)
          ? variant.stockedQuantity
          : undefined;

      return {
        optionValues: isRecord(variant.optionValues) ? getStringRecord(variant.optionValues) : {},
        sku: typeof variant.sku === "string" && variant.sku.trim() ? variant.sku.trim() : null,
        priceAmount,
        currencyCode,
        ...(stockedQuantity === undefined ? {} : { stockedQuantity }),
      };
    })
    .filter(
      (variant): variant is NonNullable<typeof variant> =>
        variant !== null && Number.isFinite(variant.priceAmount) && Boolean(variant.currencyCode),
    );

  return variants.length ? variants : undefined;
}

function getOptionValues(formData: FormData) {
  const value = formData.get("optionValues");

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getImageUrls(formData: FormData) {
  const value = formData.get("imageUrls");

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
}

function getPriceAmount(formData: FormData) {
  const value = formData.get("priceAmount");

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  return Number.parseInt(trimmed, 10);
}

function getJsonArray(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStringRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, recordValue]) => [
        key.trim(),
        typeof recordValue === "string" ? recordValue.trim() : "",
      ])
      .filter(([key, recordValue]) => key && recordValue),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
