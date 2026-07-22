import { settlementFromMetadata } from "../../../lib/settlement.js";
import type { MerchantOrder, MerchantOrderPaymentMethod } from "../../../types/index.js";
import { getNumber, getString, isRecord } from "./values.js";

export function normalizeOrder(value: unknown, salesChannelId: string): MerchantOrder[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  // Some action responses omit sales_channel_id. When present, enforce tenant isolation.
  const channelId = getString(value.sales_channel_id);
  if (channelId && channelId !== salesChannelId) {
    return [];
  }

  const fulfillments = getFulfillments(value.fulfillments);
  const shippingAddress = getShippingAddress(value.shipping_address);
  const delivery = getDeliveryDetails(value);
  const metadata = isRecord(value.metadata) ? value.metadata : {};

  const items = getLineItems(value.items);
  const total =
    getNumber(value.total) ??
    (items.length ? items.reduce((sum, item) => sum + (item.total ?? 0), 0) : null);

  const paymentMethod = resolvePaymentMethod(value, metadata);
  const paymentReference = resolvePaymentReference(metadata, value);
  const settlement = settlementFromMetadata(metadata);
  const note =
    getString(metadata.note) ??
    getString(metadata.internal_note) ??
    getString(metadata.customer_notes) ??
    null;
  const customerId = getString(value.customer_id) ?? null;
  const itemCount =
    items.length > 0
      ? items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      : (getNumber(value.items_count) ?? null);

  // Prefer real payment_status; allow explicit dashboard override only when still unpaid-ish.
  const rawPaymentStatus = getString(value.payment_status);
  const overridePaid = normalizeKey(getString(metadata.payment_status_override)) === "paid";
  const paymentStatus =
    overridePaid && isUnpaidPaymentStatus(rawPaymentStatus) ? "captured" : rawPaymentStatus;

  return [
    {
      id,
      displayId: getNumber(value.display_id) ?? null,
      email: getString(value.email),
      customerId,
      status: getString(value.status),
      paymentStatus,
      fulfillmentStatus: getString(value.fulfillment_status),
      paymentMethod,
      paymentReference,
      ...(settlement ? { settlement } : {}),
      note,
      currencyCode: getString(value.currency_code),
      total,
      subtotal: getNumber(value.subtotal) ?? null,
      shippingTotal: getNumber(value.shipping_total) ?? null,
      discountTotal: getNumber(value.discount_total) ?? null,
      itemCount,
      ...(delivery ? { delivery } : {}),
      ...(fulfillments.length === 0 ? {} : { fulfillments }),
      items,
      ...(shippingAddress ? { shippingAddress } : {}),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isUnpaidPaymentStatus(value: string | null) {
  const key = normalizeKey(value);
  if (!key) return true;
  if (key.includes("captured") || key === "paid" || key.includes("refund")) return false;
  return true;
}

export function resolvePaymentMethod(
  order: Record<string, unknown>,
  metadata: Record<string, unknown>,
): MerchantOrderPaymentMethod {
  const fromMeta =
    getString(metadata.payment_method) ??
    getString(metadata.checkout_type) ??
    getString(metadata.paymentMethod);

  const metaKey = normalizeKey(fromMeta);
  if (metaKey === "cod" || metaKey === "cash_on_delivery" || metaKey === "cash") {
    return "cod";
  }
  if (metaKey === "chapa" || metaKey === "online" || metaKey.includes("chapa")) {
    return "chapa";
  }

  const createdFrom = normalizeKey(getString(metadata.created_from));
  if (createdFrom.includes("manual") || createdFrom.includes("dashboard")) {
    return "cod";
  }

  // Inspect payment collections / sessions when present on detail payloads.
  const collections = Array.isArray(order.payment_collections)
    ? order.payment_collections
    : Array.isArray(order.payment_collection)
      ? [order.payment_collection]
      : [];

  for (const collection of collections) {
    if (!isRecord(collection)) continue;
    const sessions = Array.isArray(collection.payment_sessions)
      ? collection.payment_sessions
      : [];
    for (const session of sessions) {
      if (!isRecord(session)) continue;
      const provider = normalizeKey(getString(session.provider_id));
      if (provider.includes("chapa")) return "chapa";
      if (provider.includes("system") || provider.includes("manual")) {
        const sessionData = isRecord(session.data) ? session.data : {};
        const sessionMethod = normalizeKey(
          getString(sessionData.payment_method) ?? getString(sessionData.method),
        );
        if (sessionMethod === "cod" || sessionMethod.includes("cash")) return "cod";
      }
    }
  }

  return "unknown";
}

function resolvePaymentReference(
  metadata: Record<string, unknown>,
  order: Record<string, unknown>,
) {
  const fromMeta =
    getString(metadata.payment_reference) ??
    getString(metadata.tx_ref) ??
    getString(metadata.chapa_tx_ref) ??
    getString(metadata.provider_reference);

  if (fromMeta) return fromMeta;

  const collections = Array.isArray(order.payment_collections)
    ? order.payment_collections
    : [];

  for (const collection of collections) {
    if (!isRecord(collection)) continue;
    const sessions = Array.isArray(collection.payment_sessions)
      ? collection.payment_sessions
      : [];
    for (const session of sessions) {
      if (!isRecord(session)) continue;
      const data = isRecord(session.data) ? session.data : {};
      const ref =
        getString(data.tx_ref) ?? getString(data.txRef) ?? getString(data.reference);
      if (ref) return ref;
    }
  }

  return null;
}

export function getFulfillments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((fulfillment) => {
    if (!isRecord(fulfillment)) {
      return [];
    }

    const id = getString(fulfillment.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        deliveredAt: getString(fulfillment.delivered_at),
        shippedAt: getString(fulfillment.shipped_at),
        canceledAt: getString(fulfillment.canceled_at),
      },
    ];
  });
}

export function getShippingAddress(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const address = {
    firstName: getString(value.first_name),
    lastName: getString(value.last_name),
    phone: getString(value.phone),
    address1: getString(value.address_1),
    address2: getString(value.address_2),
    city: getString(value.city),
    province: getString(value.province),
    postalCode: getString(value.postal_code),
    countryCode: getString(value.country_code),
  };

  return hasAnyValue(address) ? address : undefined;
}

export function getDeliveryDetails(order: Record<string, unknown>) {
  const orderMetadata = isRecord(order.metadata) ? order.metadata : {};
  const shippingAddress = isRecord(order.shipping_address) ? order.shipping_address : {};
  const shippingMetadata = isRecord(shippingAddress.metadata) ? shippingAddress.metadata : {};
  const shippingName = [getString(shippingAddress.first_name), getString(shippingAddress.last_name)]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();

  const delivery = {
    choice: getString(orderMetadata.delivery_choice ?? shippingMetadata.delivery_choice),
    customerName: getString(
      orderMetadata.customer_name ??
        shippingMetadata.customer_name ??
        (shippingName || null),
    ),
    customerPhone: getString(
      orderMetadata.customer_phone ??
        shippingMetadata.customer_phone ??
        shippingAddress.phone,
    ),
    landmark: getString(orderMetadata.landmark ?? shippingMetadata.landmark),
    notes: getString(orderMetadata.customer_notes ?? shippingMetadata.customer_notes),
  };

  return hasAnyValue(delivery) ? delivery : undefined;
}

export function hasAnyValue(value: Record<string, string | null>) {
  return Object.values(value).some((item) => item !== null);
}

export function getLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = getString(item.id);

    if (!id) {
      return [];
    }

    const fulfilledQuantity = getItemFulfilledQuantity(item);
    const detail = isRecord(item.detail) ? item.detail : null;
    const quantity =
      getNumber(item.quantity) ?? (detail ? getNumber(detail.quantity) : undefined) ?? null;
    const unitPrice =
      getNumber(item.unit_price) ?? (detail ? getNumber(detail.unit_price) : undefined) ?? null;
    // Prefer computed line total when Medusa returns 0/empty totals with a real unit price.
    const reportedTotal = getNumber(item.total) ?? getNumber(item.subtotal);
    const computedTotal =
      quantity !== null && unitPrice !== null ? quantity * unitPrice : null;
    const total =
      reportedTotal !== undefined && reportedTotal !== null && reportedTotal > 0
        ? reportedTotal
        : (computedTotal ?? reportedTotal ?? null);

    const variantRecord = isRecord(item.variant) ? item.variant : null;
    const productRecord = isRecord(item.product) ? item.product : null;
    const productTitle =
      getString(item.product_title) ??
      (productRecord ? getString(productRecord.title) : null) ??
      null;
    const variantFromOptions = formatVariantOptions(variantRecord);
    const rawVariantTitle =
      getString(item.variant_title) ??
      getString(item.subtitle) ??
      (variantRecord ? getString(variantRecord.title) : null) ??
      null;
    // Prefer explicit option values ("Large / Red") over generic "Default variant".
    const variantTitle =
      variantFromOptions ||
      (rawVariantTitle && !isGenericVariantTitle(rawVariantTitle) ? rawVariantTitle : null) ||
      rawVariantTitle;
    const lineTitle = getString(item.title);
    // Prefer product name for the main line; keep variant separate for the UI.
    const title = productTitle ?? lineTitle ?? (variantTitle ? variantTitle : null);

    return [
      {
        id,
        ...(getString(item.product_id) ? { productId: getString(item.product_id) } : {}),
        ...(getString(item.variant_id) ? { variantId: getString(item.variant_id) } : {}),
        title,
        ...(productTitle ? { productTitle } : {}),
        ...(variantTitle ? { variantTitle } : {}),
        quantity,
        ...(fulfilledQuantity === null ? {} : { fulfilledQuantity }),
        unitPrice,
        total,
        thumbnail: getString(item.thumbnail),
      },
    ];
  });
}

function isGenericVariantTitle(value: string) {
  const key = value.trim().toLowerCase();
  return (
    key === "default" ||
    key === "default variant" ||
    key === "standard" ||
    key === "one size" ||
    key === "title"
  );
}

/** Build "Size: Large · Color: Red" / "Large / Red" from Medusa variant options. */
function formatVariantOptions(variant: Record<string, unknown> | null): string | null {
  if (!variant) return null;
  const options = Array.isArray(variant.options) ? variant.options : [];
  if (!options.length) return null;

  const parts: string[] = [];
  for (const raw of options) {
    if (!isRecord(raw)) continue;
    const value = getString(raw.value) ?? getString(raw.option_value);
    if (!value) continue;
    const option = isRecord(raw.option) ? raw.option : null;
    const optionTitle = option
      ? getString(option.title) ?? getString(option.name)
      : getString(raw.option_title) ?? getString(raw.title);
    if (optionTitle && !isGenericVariantTitle(optionTitle)) {
      parts.push(`${optionTitle}: ${value}`);
    } else {
      parts.push(value);
    }
  }

  if (!parts.length) return null;
  return parts.join(" · ");
}

export function getFulfillmentItems(order: MerchantOrder) {
  return (order.items ?? []).flatMap((item) => {
    const quantity = item.quantity ?? 0;
    const fulfilledQuantity = item.fulfilledQuantity ?? 0;
    const quantityToFulfill = quantity - fulfilledQuantity;

    if (quantityToFulfill <= 0) {
      return [];
    }

    return [
      {
        id: item.id,
        quantity: quantityToFulfill,
      },
    ];
  });
}

export function getItemFulfilledQuantity(item: Record<string, unknown>) {
  const direct = getNumber(item.fulfilled_quantity);

  if (direct !== undefined) {
    return direct;
  }

  if (isRecord(item.detail)) {
    return getNumber(item.detail.fulfilled_quantity) ?? null;
  }

  return null;
}
