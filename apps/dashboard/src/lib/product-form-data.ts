import type { MerchantProductWriteInput } from "./merchant-products.js";

export function getProductFormInput(formData: FormData): MerchantProductWriteInput {
  return {
    title: getOptionalString(formData, "title"),
    description: getOptionalString(formData, "description"),
    handle: getOptionalString(formData, "handle"),
    collectionId: getOptionalString(formData, "collectionId"),
    categoryIds: getStringList(formData, "categoryIds"),
    imageUrls: getImageUrls(formData),
    priceAmount: getPriceAmount(formData),
    currencyCode: getOptionalString(formData, "currencyCode"),
    status: getOptionalString(formData, "status"),
    thumbnail: getOptionalString(formData, "thumbnail"),
  };
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
