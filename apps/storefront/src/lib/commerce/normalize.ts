import { getBoolean, getNumber, getString, isRecord } from "./http.js";
import type {
  CompletedOrder,
  StoreCart,
  StoreCartItem,
  StoreDeliveryOptions,
  StoreProduct,
  StoreProductVariant,
  StoreShippingOption,
} from "./types.js";

function getCalculatedPrice(variant: Record<string, unknown>) {
  const calculated = isRecord(variant.calculated_price) ? variant.calculated_price : null;
  if (!calculated) {
    return { amount: null as number | null, currency: null as string | null };
  }

  const amount =
    getNumber(calculated.calculated_amount) ??
    getNumber(calculated.original_amount) ??
    getNumber(calculated.amount) ??
    null;

  const currency =
    getString(calculated.currency_code) ?? getString(calculated.currencyCode) ?? null;

  return { amount, currency };
}

function normalizeOptionValues(
  variant: Record<string, unknown>,
  productOptions: unknown[],
): StoreProductVariant["optionValues"] {
  const optionTitleById = new Map<string, string>();
  for (const option of productOptions) {
    if (!isRecord(option)) continue;
    const id = getString(option.id);
    const title = getString(option.title) ?? getString(option.name);
    if (id && title) optionTitleById.set(id, title);
  }

  const rawOptions = Array.isArray(variant.options) ? variant.options : [];
  const values: StoreProductVariant["optionValues"] = [];

  for (const entry of rawOptions) {
    if (!isRecord(entry)) continue;
    const value = getString(entry.value) ?? getString(entry.option_value) ?? "";
    if (!value) continue;
    const optionId = getString(entry.option_id) ?? getString(entry.optionId);
    const optionTitle =
      (optionId ? optionTitleById.get(optionId) : null) ??
      getString(entry.option_title) ??
      getString(entry.option) ??
      "Option";
    values.push({ optionTitle, value });
  }

  return values;
}

function normalizeVariant(
  value: unknown,
  productOptions: unknown[],
): StoreProductVariant | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id) return null;

  const price = getCalculatedPrice(value);
  const manageInventory = getBoolean(value.manage_inventory);
  const allowBackorder = getBoolean(value.allow_backorder);
  const inventoryQuantity = getNumber(value.inventory_quantity) ?? null;
  const inStock =
    !manageInventory || allowBackorder || (inventoryQuantity != null && inventoryQuantity > 0);

  return {
    id,
    title: getString(value.title),
    sku: getString(value.sku),
    manageInventory,
    allowBackorder,
    inventoryQuantity,
    inStock,
    priceAmount: price.amount,
    currencyCode: price.currency,
    optionValues: normalizeOptionValues(value, productOptions),
  };
}

export function normalizeProduct(value: unknown): StoreProduct {
  if (!isRecord(value)) {
    return {
      id: "",
      title: null,
      handle: null,
      description: null,
      thumbnail: null,
      images: [],
      variants: [],
      options: [],
      collectionId: null,
      collectionTitle: null,
      categoryIds: [],
      priceAmount: null,
      currencyCode: null,
    };
  }

  const productOptions = Array.isArray(value.options) ? value.options : [];
  const variants = (Array.isArray(value.variants) ? value.variants : [])
    .map((variant) => normalizeVariant(variant, productOptions))
    .filter((variant): variant is StoreProductVariant => Boolean(variant));

  const options = productOptions
    .map((option) => {
      if (!isRecord(option)) return null;
      const id = getString(option.id) ?? "";
      const title = getString(option.title) ?? getString(option.name) ?? "Option";
      const values: string[] = [];
      if (Array.isArray(option.values)) {
        for (const entry of option.values) {
          const v =
            typeof entry === "string"
              ? entry
              : isRecord(entry)
                ? (getString(entry.value) ?? getString(entry.name) ?? "")
                : "";
          if (v && !values.includes(v)) values.push(v);
        }
      }
      // Fall back to values present on variants.
      if (!values.length) {
        for (const variant of variants) {
          for (const ov of variant.optionValues) {
            if (ov.optionTitle === title && !values.includes(ov.value)) values.push(ov.value);
          }
        }
      }
      return id || title ? { id: id || title, title, values } : null;
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  const images: string[] = [];
  if (Array.isArray(value.images)) {
    for (const image of value.images) {
      const url = isRecord(image) ? getString(image.url) : getString(image);
      if (url) images.push(url);
    }
  }

  const collection = isRecord(value.collection) ? value.collection : null;
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const categoryIds: string[] = [];
  for (const category of categories) {
    if (!isRecord(category)) continue;
    const id = getString(category.id);
    if (id) categoryIds.push(id);
  }

  const thumbnail = getString(value.thumbnail) ?? images[0] ?? null;
  const priced = variants.find((v) => v.priceAmount != null) ?? variants[0];

  return {
    id: getString(value.id) ?? "",
    title: getString(value.title),
    handle: getString(value.handle),
    description: getString(value.description),
    thumbnail,
    images,
    variants,
    options,
    collectionId: getString(value.collection_id) ?? getString(collection?.id),
    collectionTitle: getString(collection?.title),
    categoryIds,
    priceAmount: priced?.priceAmount ?? null,
    currencyCode: priced?.currencyCode ?? null,
  };
}

function normalizeCartItem(value: unknown): StoreCartItem | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id) return null;

  const variant = isRecord(value.variant) ? value.variant : null;
  const product = isRecord(value.product)
    ? value.product
    : isRecord(variant?.product)
      ? variant.product
      : null;

  return {
    id,
    title: getString(value.title) ?? getString(value.product_title) ?? getString(product?.title),
    quantity: getNumber(value.quantity) ?? 0,
    unitPrice: getNumber(value.unit_price) ?? getNumber(value.unitPrice) ?? null,
    total: getNumber(value.total) ?? getNumber(value.subtotal) ?? null,
    thumbnail:
      getString(value.thumbnail) ??
      getString(product?.thumbnail) ??
      (isRecord(product?.images) ? null : null),
    variantId: getString(value.variant_id) ?? getString(variant?.id),
    productHandle: getString(product?.handle) ?? getString(value.product_handle),
    variantTitle: getString(value.variant_title) ?? getString(variant?.title),
  };
}

export function normalizeCart(value: unknown): StoreCart {
  if (!isRecord(value)) {
    return {
      id: "",
      regionId: null,
      email: null,
      currencyCode: null,
      itemTotal: null,
      shippingTotal: null,
      total: null,
      items: [],
    };
  }

  const items = (Array.isArray(value.items) ? value.items : [])
    .map(normalizeCartItem)
    .filter((item): item is StoreCartItem => Boolean(item));

  return {
    id: getString(value.id) ?? "",
    regionId: getString(value.region_id) ?? getString(value.regionId),
    email: getString(value.email),
    currencyCode: getString(value.currency_code) ?? getString(value.currencyCode),
    itemTotal: getNumber(value.item_total) ?? getNumber(value.itemTotal) ?? null,
    shippingTotal: getNumber(value.shipping_total) ?? getNumber(value.shippingTotal) ?? null,
    total: getNumber(value.total) ?? null,
    items,
  };
}

export function normalizeDeliveryOptions(value: unknown): StoreDeliveryOptions {
  if (!isRecord(value)) {
    return {
      deliveryEnabled: false,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: false,
      defaultDeliveryFee: "0",
      currency: "ETB",
      zones: [],
    };
  }

  return {
    deliveryEnabled: getBoolean(value.deliveryEnabled),
    pickupEnabled: getBoolean(value.pickupEnabled),
    phoneConfirmationRequired: getBoolean(value.phoneConfirmationRequired),
    notesEnabled: getBoolean(value.notesEnabled),
    landmarkRequired: getBoolean(value.landmarkRequired),
    defaultDeliveryFee: getString(value.defaultDeliveryFee) ?? "0",
    currency: getString(value.currency) ?? "ETB",
    zones: Array.isArray(value.zones) ? value.zones : [],
  };
}

export function normalizeShippingOption(value: unknown): StoreShippingOption | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id) return null;

  const amount =
    getNumber(value.amount) ??
    getNumber(isRecord(value.price_incl_tax) ? value.price_incl_tax : null) ??
    getNumber(isRecord(value.calculated_price) ? value.calculated_price.calculated_amount : null) ??
    null;

  return {
    id,
    name: getString(value.name) ?? getString(value.label),
    amount,
    currencyCode: getString(value.currency_code) ?? getString(value.currencyCode),
  };
}

export function normalizeCompletedOrder(data: unknown): CompletedOrder | null {
  if (!isRecord(data)) return null;

  const order =
    isRecord(data.order) && data.type === "order"
      ? data.order
      : isRecord(data.order)
        ? data.order
        : data;

  if (!isRecord(order)) return null;
  const id = getString(order.id);
  if (!id) return null;

  return {
    id,
    displayId:
      getString(order.display_id) ??
      (getNumber(order.display_id) != null ? String(getNumber(order.display_id)) : null),
    total: getNumber(order.total) ?? null,
    currencyCode: getString(order.currency_code) ?? getString(order.currencyCode),
    email: getString(order.email),
  };
}
