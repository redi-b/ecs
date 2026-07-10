import type { MerchantOrder } from "../../../types/index.js";
import { getNumber, getString, isRecord } from "./values.js";

export function normalizeOrder(value: unknown, salesChannelId: string): MerchantOrder[] {
  if (!isRecord(value) || value.sales_channel_id !== salesChannelId) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  const fulfillments = getFulfillments(value.fulfillments);
  const shippingAddress = getShippingAddress(value.shipping_address);
  const delivery = getDeliveryDetails(value);

  return [
    {
      id,
      displayId: getNumber(value.display_id) ?? null,
      email: getString(value.email),
      status: getString(value.status),
      paymentStatus: getString(value.payment_status),
      fulfillmentStatus: getString(value.fulfillment_status),
      currencyCode: getString(value.currency_code),
      total: getNumber(value.total) ?? null,
      ...(delivery ? { delivery } : {}),
      ...(fulfillments.length === 0 ? {} : { fulfillments }),
      items: getLineItems(value.items),
      ...(shippingAddress ? { shippingAddress } : {}),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
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

  const delivery = {
    choice: getString(orderMetadata.delivery_choice ?? shippingMetadata.delivery_choice),
    customerName: getString(orderMetadata.customer_name ?? shippingMetadata.customer_name),
    customerPhone: getString(orderMetadata.customer_phone ?? shippingMetadata.customer_phone),
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

    return [
      {
        id,
        ...(getString(item.product_id) ? { productId: getString(item.product_id) } : {}),
        ...(getString(item.variant_id) ? { variantId: getString(item.variant_id) } : {}),
        title: getString(item.title),
        quantity: getNumber(item.quantity) ?? null,
        ...(fulfilledQuantity === null ? {} : { fulfilledQuantity }),
        unitPrice: getNumber(item.unit_price) ?? null,
        total: getNumber(item.total) ?? null,
        thumbnail: getString(item.thumbnail),
      },
    ];
  });
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
