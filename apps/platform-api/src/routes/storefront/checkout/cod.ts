import type { PlatformAppOptions } from "../../../app.js";
import { buildOrderCreatedPayloadFromComplete } from "../../../modules/notifications/order-payload.js";

type CodCheckoutInput = {
  address: {
    address1: string;
    city: string;
    landmark?: string | null;
  };
  cartId: string;
  customer: {
    email?: string | null;
    name: string;
    phone: string;
  };
  deliveryChoice: "delivery" | "pickup";
  notes?: string | null;
  shippingOptionId: string;
};

async function getOptionalJsonObjectBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  const parsed = JSON.parse(rawBody);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object body.");
  }

  return parsed as Record<string, unknown>;
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function getObjectValue(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getCodCheckoutInput(body: Record<string, unknown>): CodCheckoutInput | undefined {
  const customer = getObjectValue(body.customer);
  const address = getObjectValue(body.address);
  const deliveryChoice = getStringValue(body.deliveryChoice);

  if (!customer || !address || (deliveryChoice !== "delivery" && deliveryChoice !== "pickup")) {
    return undefined;
  }

  const cartId = getStringValue(body.cartId);
  const shippingOptionId = getStringValue(body.shippingOptionId);
  const name = getStringValue(customer.name);
  const phone = getStringValue(customer.phone);
  const address1 = getStringValue(address.address1);
  const city = getStringValue(address.city);

  if (!cartId || !shippingOptionId || !name || !phone || !address1 || !city) {
    return undefined;
  }

  return {
    address: {
      address1,
      city,
      landmark: getStringValue(address.landmark) ?? null,
    },
    cartId,
    customer: {
      email: getStringValue(customer.email) ?? null,
      name,
      phone,
    },
    deliveryChoice,
    notes: getStringValue(body.notes) ?? null,
    shippingOptionId,
  };
}

function getMedusaStoreJsonRequest(options: {
  body: Record<string, unknown>;
  medusaInternalUrl: string;
  path: string;
  publishableKey: string;
}) {
  const medusaUrl = new URL(options.medusaInternalUrl);
  medusaUrl.pathname = options.path;

  return new Request(medusaUrl, {
    body: JSON.stringify(options.body),
    duplex: "half",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": options.publishableKey,
    },
    method: "POST",
    redirect: "manual",
  } as RequestInit);
}

async function getJsonResponseBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function getPaymentCollectionId(data: unknown) {
  const paymentCollection = getObjectValue(getObjectValue(data)?.payment_collection);

  return getStringValue(paymentCollection?.id);
}

function getCompletedOrderId(data: unknown) {
  const body = getObjectValue(data);

  if (body?.type !== "order") {
    return undefined;
  }

  return getStringValue(getObjectValue(body.order)?.id);
}

function getMedusaPassthroughResponse(response: Response) {
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function completeCodCheckout(options: {
  delivery: NonNullable<PlatformAppOptions["getDeliverySettings"]>;
  medusaInternalUrl: string;
  medusaPublishableKeyId: string;
  medusaStoreFetch: typeof fetch;
  recordAnalyticsEvent?: PlatformAppOptions["recordAnalyticsEvent"];
  recordNotificationEvent?: PlatformAppOptions["recordNotificationEvent"];
  request: Request;
  tenantId: string;
}) {
  let input: CodCheckoutInput | undefined;

  try {
    input = getCodCheckoutInput(await getOptionalJsonObjectBody(options.request));
  } catch {
    return Response.json({ error: "invalid_cod_checkout_request" }, { status: 400 });
  }

  if (!input) {
    return Response.json({ error: "invalid_cod_checkout_request" }, { status: 400 });
  }

  const delivery = await options.delivery({ tenantId: options.tenantId });
  const deliverySettings = delivery.delivery;

  if (input.deliveryChoice === "delivery" && !deliverySettings.deliveryEnabled) {
    return Response.json({ error: "delivery_unavailable" }, { status: 409 });
  }

  if (input.deliveryChoice === "pickup" && !deliverySettings.pickupEnabled) {
    return Response.json({ error: "pickup_unavailable" }, { status: 409 });
  }

  if (
    input.deliveryChoice === "delivery" &&
    deliverySettings.landmarkRequired &&
    !input.address.landmark
  ) {
    return Response.json({ error: "landmark_required" }, { status: 400 });
  }

  const updateCartResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {
        ...(input.customer.email ? { email: input.customer.email } : {}),
        shipping_address: {
          first_name: input.customer.name,
          phone: input.customer.phone,
          address_1: input.address.address1,
          city: input.address.city,
          country_code: "et",
        },
        metadata: {
          checkout_type: "cod",
          payment_method: "cod",
          delivery_choice: input.deliveryChoice,
          customer_name: input.customer.name,
          customer_phone: input.customer.phone,
          landmark: input.address.landmark,
          customer_notes: input.notes,
        },
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/carts/${encodeURIComponent(input.cartId)}`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!updateCartResponse.ok) {
    return getMedusaPassthroughResponse(updateCartResponse);
  }

  const shippingMethodResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {
        option_id: input.shippingOptionId,
        data: {
          delivery_choice: input.deliveryChoice,
          landmark: input.address.landmark,
          customer_notes: input.notes,
        },
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/carts/${encodeURIComponent(input.cartId)}/shipping-methods`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!shippingMethodResponse.ok) {
    return getMedusaPassthroughResponse(shippingMethodResponse);
  }

  const paymentCollectionResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {
        cart_id: input.cartId,
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: "/store/payment-collections",
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!paymentCollectionResponse.ok) {
    return getMedusaPassthroughResponse(paymentCollectionResponse);
  }

  const paymentCollectionId = getPaymentCollectionId(
    await getJsonResponseBody(paymentCollectionResponse),
  );

  if (!paymentCollectionId) {
    return Response.json({ error: "payment_collection_unavailable" }, { status: 503 });
  }

  const paymentSessionResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {
        provider_id: "pp_system_default",
        data: {
          payment_method: "cod",
        },
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/payment-collections/${encodeURIComponent(paymentCollectionId)}/payment-sessions`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!paymentSessionResponse.ok) {
    return getMedusaPassthroughResponse(paymentSessionResponse);
  }

  const completeCartResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {},
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/carts/${encodeURIComponent(input.cartId)}/complete`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!completeCartResponse.ok) {
    return getMedusaPassthroughResponse(completeCartResponse);
  }

  const completeCartBody = await getJsonResponseBody(completeCartResponse);
  const orderId = getCompletedOrderId(completeCartBody);

  if (orderId && options.recordAnalyticsEvent) {
    try {
      await options.recordAnalyticsEvent({
        eventType: "order.created",
        idempotencyKey: `cod:${input.cartId}:order.created`,
        properties: {
          cartId: input.cartId,
          deliveryChoice: input.deliveryChoice,
          orderId,
          paymentMethod: "cod",
        },
        source: "platform",
        subjectId: orderId,
        subjectType: "order",
        tenantId: options.tenantId,
      });
    } catch {
      // Analytics logging must not fail a completed checkout.
    }
  }

  if (orderId && options.recordNotificationEvent) {
    try {
      // Single merchant event: order.created (items/customer for Telegram/email alerts).
      await options.recordNotificationEvent({
        eventType: "order.created",
        payload: {
          ...buildOrderCreatedPayloadFromComplete({
            orderId,
            completeBody: completeCartBody,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerCity: input.address.city,
            deliveryChoice: input.deliveryChoice,
            paymentMethod: "cod",
            paymentStatus: "pending",
          }),
          cartId: input.cartId,
        },
        tenantId: options.tenantId,
      });
    } catch {
      // Notification logging must not fail a completed checkout.
    }
  }

  return Response.json(completeCartBody, {
    headers: completeCartResponse.headers,
    status: completeCartResponse.status,
    statusText: completeCartResponse.statusText,
  });
}
