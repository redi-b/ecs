import { normalizeStorefrontMediaUrl } from "../media-url.js";
import { getBoolean, getNumber, getString, isRecord } from "./http.js";
import type {
  CompletedOrder,
  ImageVariants,
  StoreCart,
  StoreCartItem,
  StoreDeliveryOptions,
  StoreProduct,
  StoreProductImage,
  StoreProductVariant,
  StoreShippingOption,
} from "./types.js";

function getCalculatedPrice(variant: Record<string, unknown>) {
  const calculated = isRecord(variant.calculated_price) ? variant.calculated_price : null;
  if (!calculated) {
    return {
      amount: null as number | null,
      originalAmount: null as number | null,
      discountAmount: null as number | null,
      discountPercentage: null as number | null,
      currency: null as string | null,
    };
  }

  const calculatedAmount = getNumber(calculated.calculated_amount);
  const originalAmount = getNumber(calculated.original_amount);
  const amount = calculatedAmount ?? originalAmount ?? getNumber(calculated.amount) ?? null;
  const hasDiscount = amount != null && originalAmount != null && originalAmount > amount;
  const discountAmount = hasDiscount ? originalAmount - amount : null;
  const discountPercentage =
    hasDiscount && discountAmount != null && originalAmount > 0
      ? Math.round((discountAmount / originalAmount) * 100)
      : null;

  const currency =
    getString(calculated.currency_code) ?? getString(calculated.currencyCode) ?? null;

  return {
    amount,
    originalAmount: hasDiscount ? originalAmount : null,
    discountAmount,
    discountPercentage,
    currency,
  };
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

function parseImageVariants(entry: unknown): ImageVariants | undefined {
  if (!isRecord(entry)) return undefined;
  const variants: ImageVariants = {};
  if (typeof entry.w200 === "string" && entry.w200.trim()) variants.w200 = entry.w200.trim();
  if (typeof entry.w400 === "string" && entry.w400.trim()) variants.w400 = entry.w400.trim();
  if (typeof entry.w800 === "string" && entry.w800.trim()) variants.w800 = entry.w800.trim();
  if (typeof entry.w1200 === "string" && entry.w1200.trim()) variants.w1200 = entry.w1200.trim();
  return Object.keys(variants).length > 0 ? variants : undefined;
}

function resolveMediaUrl(value: unknown): string | null {
  const candidate = getString(value)?.trim();
  if (!candidate) return null;
  const trusted = normalizeStorefrontMediaUrl(candidate);
  if (trusted) return trusted;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {}
  return null;
}

function resolveImageVariants(
  url: string,
  rawMediaVariants?: Record<string, unknown> | null,
): ImageVariants | undefined {
  if (!rawMediaVariants) return undefined;
  if (rawMediaVariants[url]) return parseImageVariants(rawMediaVariants[url]);
  try {
    const decoded = decodeURI(url);
    if (decoded !== url && rawMediaVariants[decoded]) {
      return parseImageVariants(rawMediaVariants[decoded]);
    }
  } catch {}
  return undefined;
}

export function normalizeVariant(
  value: unknown,
  productOptions: unknown[],
  rawMediaVariants?: Record<string, unknown> | null,
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

  const metadata = isRecord(value.metadata) ? value.metadata : null;
  const variantMediaVariants = isRecord(metadata?.media_variants)
    ? (metadata.media_variants as Record<string, unknown>)
    : null;
  const combinedMediaVariants = variantMediaVariants ?? rawMediaVariants;

  const candidateImageUrl =
    (metadata && metadata.image_url !== undefined ? metadata.image_url : undefined) ??
    (value.imageUrl !== undefined ? value.imageUrl : undefined) ??
    (value.thumbnail !== undefined ? value.thumbnail : undefined) ??
    (value.image_url !== undefined ? value.image_url : undefined);

  const imageUrl = candidateImageUrl !== undefined ? resolveMediaUrl(candidateImageUrl) : undefined;
  const imageVariants = imageUrl
    ? resolveImageVariants(imageUrl, combinedMediaVariants)
    : undefined;

  return {
    id,
    title: getString(value.title),
    sku: getString(value.sku),
    manageInventory,
    allowBackorder,
    inventoryQuantity,
    inStock,
    priceAmount: price.amount,
    originalPriceAmount: price.originalAmount,
    discountAmount: price.discountAmount,
    discountPercentage: price.discountPercentage,
    currencyCode: price.currency,
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(imageVariants !== undefined ? { imageVariants } : {}),
    optionValues: normalizeOptionValues(value, productOptions),
  };
}

function parseOptionMediaBindings(
  metadata: unknown,
  direct?: unknown,
): { optionTitle: string; mappings: Record<string, string[]> } | null | undefined {
  const candidate =
    isRecord(metadata) && metadata.option_media_bindings !== undefined
      ? metadata.option_media_bindings
      : direct;

  if (candidate === undefined) return undefined;
  if (candidate === null) return null;

  let parsed = candidate;
  if (typeof candidate === "string") {
    try {
      parsed = JSON.parse(candidate);
    } catch {
      return undefined;
    }
  }

  if (!isRecord(parsed)) return undefined;
  const optionTitle = getString(parsed.optionTitle);
  if (!optionTitle) return undefined;

  const rawMappings = isRecord(parsed.mappings) ? parsed.mappings : {};
  const mappings: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(rawMappings)) {
    if (Array.isArray(list)) {
      mappings[key] = list
        .map((item) => (typeof item === "string" ? (resolveMediaUrl(item) ?? item) : ""))
        .filter(Boolean);
    }
  }

  return { optionTitle, mappings };
}

function getExplicitOptionDisplayMode(metadata: unknown) {
  if (!isRecord(metadata)) return null;
  const presentation = metadata.ecs_option_value_presentation;
  if (!isRecord(presentation) || presentation.version !== 1) return null;
  return presentation.displayMode === "text" || presentation.displayMode === "swatch"
    ? presentation.displayMode
    : null;
}

function getExplicitOptionValueSwatch(metadata: unknown) {
  if (!isRecord(metadata)) return null;
  const presentation = metadata.ecs_option_value_presentation;
  if (!isRecord(presentation) || presentation.version !== 1) return null;
  const swatch = presentation.swatch;
  if (!isRecord(swatch)) return null;
  if (swatch.kind === "color") {
    const value = getString(swatch.value)?.toLowerCase() ?? "";
    return /^#[0-9a-f]{6}$/.test(value) ? { kind: "color" as const, value } : null;
  }
  if (swatch.kind === "image") {
    const url = resolveMediaUrl(swatch.url) ?? getString(swatch.url);
    return url ? { kind: "image" as const, url } : null;
  }
  return null;
}

export function filterProductGallery(params: {
  images: StoreProductImage[];
  selectedOptions: Record<string, string>;
  optionMediaBindings?: { optionTitle: string; mappings: Record<string, string[]> } | null;
}): StoreProductImage[] {
  const { images, selectedOptions, optionMediaBindings } = params;
  if (!images || images.length === 0) return [];
  if (!optionMediaBindings || !optionMediaBindings.mappings || !optionMediaBindings.optionTitle) {
    return images;
  }

  const boundTitle = optionMediaBindings.optionTitle.trim().toLowerCase();
  const matchingEntry = Object.entries(selectedOptions || {}).find(
    ([title]) => title.trim().toLowerCase() === boundTitle,
  );
  if (!matchingEntry) {
    return images;
  }

  const selectedValue = matchingEntry[1]?.trim();
  if (!selectedValue) {
    return images;
  }

  const mappingKey = Object.keys(optionMediaBindings.mappings).find(
    (key) => key.trim().toLowerCase() === selectedValue.toLowerCase(),
  );
  if (!mappingKey) {
    return images;
  }

  const taggedUrls = new Set(optionMediaBindings.mappings[mappingKey] || []);
  const allTaggedUrls = new Set(Object.values(optionMediaBindings.mappings).flat());

  const filtered = images.filter((img) => {
    const isTaggedForSelected = taggedUrls.has(img.url);
    const isUniversal = !allTaggedUrls.has(img.url);
    return isTaggedForSelected || isUniversal;
  });

  return filtered.length > 0 ? filtered : images;
}

export function normalizeProduct(value: unknown): StoreProduct {
  if (!isRecord(value)) {
    return {
      id: "",
      title: null,
      handle: null,
      description: null,
      thumbnail: null,
      thumbnailVariants: undefined,
      images: [],
      gallery: [],
      variants: [],
      options: [],
      collectionId: null,
      collectionTitle: null,
      categoryIds: [],
      priceAmount: null,
      currencyCode: null,
    };
  }

  const metadata = isRecord(value.metadata) ? value.metadata : null;
  const rawMediaVariants = isRecord(metadata?.media_variants)
    ? (metadata.media_variants as Record<string, unknown>)
    : null;

  const productOptions = Array.isArray(value.options) ? value.options : [];
  const variants = (Array.isArray(value.variants) ? value.variants : [])
    .map((variant) => normalizeVariant(variant, productOptions, rawMediaVariants))
    .filter((variant): variant is StoreProductVariant => Boolean(variant));

  const options = productOptions
    .map((option) => {
      if (!isRecord(option)) return null;
      const id = getString(option.id) ?? "";
      const title = getString(option.title) ?? getString(option.name) ?? "Option";
      const values: string[] = [];
      let displayMode: "text" | "swatch" | null = null;
      const swatches: Record<string, string> = {};
      const optionSwatches: Record<
        string,
        { kind: "color"; value: string } | { kind: "image"; url: string }
      > = {};
      if (Array.isArray(option.values)) {
        for (const entry of option.values) {
          const v =
            typeof entry === "string"
              ? entry
              : isRecord(entry)
                ? (getString(entry.value) ?? getString(entry.name) ?? "")
                : "";
          if (v && !values.includes(v)) values.push(v);
          if (v && isRecord(entry)) {
            displayMode ??= getExplicitOptionDisplayMode(entry.metadata);
            const swatch = getExplicitOptionValueSwatch(entry.metadata);
            if (swatch) {
              optionSwatches[v] = swatch;
              if (swatch.kind === "color") {
                swatches[v] = swatch.value;
              }
            }
          }
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
      return id || title
        ? {
            id: id || title,
            title,
            values,
            ...(displayMode ? { displayMode } : {}),
            ...(Object.keys(swatches).length ? { swatches } : {}),
            ...(Object.keys(optionSwatches).length ? { optionSwatches } : {}),
          }
        : null;
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  const extractVariants = (url: string): ImageVariants | undefined =>
    resolveImageVariants(url, rawMediaVariants);

  const images: string[] = [];
  const gallery: StoreProductImage[] = [];
  if (Array.isArray(value.images)) {
    for (const image of value.images) {
      const raw = isRecord(image) ? image.url : image;
      const url = resolveMediaUrl(raw);
      if (url && !images.includes(url)) {
        images.push(url);
        const variants = extractVariants(url);
        gallery.push({
          url,
          ...(variants ? { variants } : {}),
        });
      }
    }
  }

  const thumbnail = resolveMediaUrl(value.thumbnail) ?? images[0] ?? null;
  const thumbnailVariants = thumbnail ? extractVariants(thumbnail) : undefined;

  if (thumbnail && !images.includes(thumbnail)) {
    gallery.unshift({
      url: thumbnail,
      ...(thumbnailVariants ? { variants: thumbnailVariants } : {}),
    });
  }

  const collection = isRecord(value.collection) ? value.collection : null;
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const categoryIds: string[] = [];
  for (const category of categories) {
    if (!isRecord(category)) continue;
    const id = getString(category.id);
    if (id) categoryIds.push(id);
  }

  const priced = variants.find((v) => v.priceAmount != null) ?? variants[0];
  const optionMediaBindings = parseOptionMediaBindings(metadata, value.optionMediaBindings);

  return {
    id: getString(value.id) ?? "",
    title: getString(value.title),
    handle: getString(value.handle),
    description: getString(value.description),
    thumbnail,
    thumbnailVariants,
    images,
    gallery,
    variants,
    options,
    ...(optionMediaBindings !== undefined ? { optionMediaBindings } : {}),
    collectionId: getString(value.collection_id) ?? getString(collection?.id),
    collectionTitle: getString(collection?.title),
    categoryIds,
    priceAmount: priced?.priceAmount ?? null,
    originalPriceAmount: priced?.originalPriceAmount ?? null,
    discountAmount: priced?.discountAmount ?? null,
    discountPercentage: priced?.discountPercentage ?? null,
    currencyCode: priced?.currencyCode ?? null,
  };
}

export const normalizeStoreProduct = normalizeProduct;

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

  const variantImageUrl =
    (isRecord(variant?.metadata) ? getString(variant.metadata.image_url) : null) ??
    getString(variant?.imageUrl) ??
    getString(variant?.image_url) ??
    getString(variant?.thumbnail);

  const thumbnail = resolveMediaUrl(
    variantImageUrl ?? getString(value.thumbnail) ?? getString(product?.thumbnail),
  );

  const imageUrl = resolveMediaUrl(variantImageUrl) ?? thumbnail;

  return {
    id,
    title: getString(value.title) ?? getString(value.product_title) ?? getString(product?.title),
    quantity: getNumber(value.quantity) ?? 0,
    unitPrice: getNumber(value.unit_price) ?? getNumber(value.unitPrice) ?? null,
    total: getNumber(value.total) ?? getNumber(value.subtotal) ?? null,
    thumbnail,
    imageUrl,
    variantId: getString(value.variant_id) ?? getString(variant?.id),
    productHandle: getString(product?.handle) ?? getString(value.product_handle),
    variantTitle: getString(value.variant_title) ?? getString(variant?.title),
    subtotal: getNumber(value.subtotal) ?? null,
    discountTotal: getNumber(value.discount_total) ?? null,
    originalTotal: getNumber(value.original_total) ?? null,
  };
}

function normalizeCartPromotion(value: unknown) {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id) return null;
  const method = isRecord(value.application_method) ? value.application_method : null;

  return {
    id,
    code: getString(value.code),
    isAutomatic: getBoolean(value.is_automatic),
    applicationMethod: method
      ? {
          type: getString(method.type),
          value: getNumber(method.value) ?? null,
          currencyCode: getString(method.currency_code),
        }
      : null,
  };
}

export function normalizeCart(value: unknown): StoreCart {
  if (!isRecord(value)) {
    return createEmptyStoreCart();
  }

  const items = (Array.isArray(value.items) ? value.items : [])
    .map(normalizeCartItem)
    .filter((item): item is StoreCartItem => Boolean(item));
  const promotions = (Array.isArray(value.promotions) ? value.promotions : [])
    .map(normalizeCartPromotion)
    .filter((promotion): promotion is NonNullable<typeof promotion> => Boolean(promotion));

  return {
    id: getString(value.id) ?? "",
    locale: getString(value.locale),
    regionId: getString(value.region_id) ?? getString(value.regionId),
    email: getString(value.email),
    currencyCode: getString(value.currency_code) ?? getString(value.currencyCode),
    subtotal: getNumber(value.subtotal) ?? null,
    itemTotal: getNumber(value.item_total) ?? getNumber(value.itemTotal) ?? null,
    itemSubtotal: getNumber(value.item_subtotal) ?? null,
    itemDiscountTotal: getNumber(value.item_discount_total) ?? null,
    shippingTotal: getNumber(value.shipping_total) ?? getNumber(value.shippingTotal) ?? null,
    shippingSubtotal: getNumber(value.shipping_subtotal) ?? null,
    shippingDiscountTotal: getNumber(value.shipping_discount_total) ?? null,
    taxTotal: getNumber(value.tax_total) ?? null,
    discountTotal: getNumber(value.discount_total) ?? null,
    originalTotal: getNumber(value.original_total) ?? null,
    total: getNumber(value.total) ?? null,
    promotions,
    items,
  };
}

export function createEmptyStoreCart(): StoreCart {
  return {
    id: "",
    locale: null,
    regionId: null,
    email: null,
    currencyCode: null,
    subtotal: null,
    itemTotal: null,
    itemSubtotal: null,
    itemDiscountTotal: null,
    shippingTotal: null,
    shippingSubtotal: null,
    shippingDiscountTotal: null,
    taxTotal: null,
    discountTotal: null,
    originalTotal: null,
    total: null,
    promotions: [],
    items: [],
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
    phoneConfirmationRequired: true,
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
