import { createChapaPaymentService } from "../../../adapters/chapa/payment-service.js";

type ChapaCheckoutInput = {
  cartId: string;
  returnUrl?: string | null;
  customer?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
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

function getChapaCheckoutInput(body: Record<string, unknown>): ChapaCheckoutInput | undefined {
  const cartId = getStringValue(body.cartId);

  if (!cartId) {
    return undefined;
  }

  const customer = getObjectValue(body.customer);

  return {
    cartId,
    returnUrl: getStringValue(body.returnUrl) ?? null,
    customer: customer
      ? {
          email: getStringValue(customer.email) ?? null,
          firstName: getStringValue(customer.firstName) ?? getStringValue(customer.name) ?? null,
          lastName: getStringValue(customer.lastName) ?? null,
        }
      : undefined,
  };
}

function getMedusaStoreJsonRequest(options: {
  body?: Record<string, unknown>;
  medusaInternalUrl: string;
  method?: string;
  path: string;
  publishableKey: string;
}) {
  const medusaUrl = new URL(options.medusaInternalUrl);
  medusaUrl.pathname = options.path;
  const method = options.method ?? "POST";
  const headers: Record<string, string> = {
    "x-publishable-api-key": options.publishableKey,
  };
  const init: RequestInit = {
    headers,
    method,
    redirect: "manual",
  };

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(options.body);
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  return new Request(medusaUrl, init);
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

function isChapaPaidStatus(status: string | undefined) {
  const normalized = status?.trim().toLowerCase();
  return normalized === "success" || normalized === "successful";
}

async function getJsonResponseBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function getFallbackReturnUrl(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  return new URL("/checkout/payment-return", origin).toString();
}

function getCallbackUrl(options: { platformPublicBaseUrl: string; tenantId: string }) {
  const callbackUrl = new URL("/platform/payments/chapa/callback", options.platformPublicBaseUrl);
  callbackUrl.searchParams.set("tenant_id", options.tenantId);

  return callbackUrl.toString();
}

function getCartTotalAmount(cart: Record<string, unknown> | undefined) {
  const total = cart?.total;
  if (typeof total === "number" && Number.isFinite(total)) {
    return total.toFixed(2);
  }
  if (typeof total === "string" && total.trim()) {
    const n = Number(total);
    if (Number.isFinite(n)) return n.toFixed(2);
  }
  return null;
}

/**
 * Store checkout Chapa init using **merchant** credentials only.
 * Does not use platform billing CHAPA_SECRET_KEY or Medusa global CHAPA_SECRET_KEY.
 */
export async function initializeChapaCheckout(options: {
  getMerchantChapaCredentials: (input: { tenantId: string }) => Promise<
    | { ok: true; secretKey: string; providerAccountRef: string | null }
    | { ok: false; error: "merchant_chapa_not_configured" }
  >;
  medusaInternalUrl: string;
  medusaPublishableKeyId: string;
  medusaStoreFetch: typeof fetch;
  platformPublicBaseUrl: string;
  request: Request;
  tenantId: string;
}) {
  let input: ChapaCheckoutInput | undefined;

  try {
    input = getChapaCheckoutInput(await getOptionalJsonObjectBody(options.request));
  } catch {
    return Response.json({ error: "invalid_chapa_checkout_request" }, { status: 400 });
  }

  if (!input) {
    return Response.json({ error: "invalid_chapa_checkout_request" }, { status: 400 });
  }

  const credentials = await options.getMerchantChapaCredentials({
    tenantId: options.tenantId,
  });

  if (!credentials.ok) {
    return Response.json({ error: "merchant_chapa_not_configured" }, { status: 409 });
  }

  const cartResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      medusaInternalUrl: options.medusaInternalUrl,
      method: "GET",
      path: `/store/carts/${encodeURIComponent(input.cartId)}`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!cartResponse.ok) {
    return new Response(cartResponse.body, {
      headers: cartResponse.headers,
      status: cartResponse.status,
      statusText: cartResponse.statusText,
    });
  }

  const cartBody = await getJsonResponseBody(cartResponse);
  const cart = getObjectValue(getObjectValue(cartBody)?.cart) ?? getObjectValue(cartBody);
  const amount = getCartTotalAmount(cart);

  if (!amount) {
    return Response.json({ error: "cart_total_unavailable" }, { status: 409 });
  }

  const currency =
    getStringValue(cart?.currency_code) ?? getStringValue(cart?.currencyCode) ?? "ETB";
  const email =
    getStringValue(input.customer?.email) ??
    getStringValue(cart?.email) ??
    "customer@example.com";

  const txRef = `ecs_store_${input.cartId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}_${Date.now().toString(36)}`.slice(
    0,
    50,
  );

  const chapa = createChapaPaymentService({
    secretKey: credentials.secretKey,
  });

  try {
    const initialized = await chapa.initializePayment({
      amount,
      currency,
      email,
      firstName: input.customer?.firstName ?? "Customer",
      lastName: input.customer?.lastName ?? "Buyer",
      txRef,
      callbackUrl: getCallbackUrl({
        platformPublicBaseUrl: options.platformPublicBaseUrl,
        tenantId: options.tenantId,
      }),
      returnUrl: input.returnUrl ?? getFallbackReturnUrl(options.request),
      title: "Store order",
      description: "Order payment",
    });

    // Record pending payment intent on cart metadata for return/complete reconciliation.
    await options.medusaStoreFetch(
      getMedusaStoreJsonRequest({
        body: {
          metadata: {
            ...(getObjectValue(cart?.metadata) ?? {}),
            chapa_tx_ref: initialized.txRef,
            payment_method: "chapa",
          },
        },
        medusaInternalUrl: options.medusaInternalUrl,
        path: `/store/carts/${encodeURIComponent(input.cartId)}`,
        publishableKey: options.medusaPublishableKeyId,
      }),
    );

    return Response.json({
      checkoutUrl: initialized.checkoutUrl,
      paymentSession: {
        id: initialized.txRef,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chapa_init_failed";
    return Response.json({ error: "chapa_init_failed", message }, { status: 502 });
  }
}

/**
 * After Chapa return/redirect: verify with **merchant** secret, then complete Medusa cart.
 * Never trusts client-reported success alone.
 */
export async function completeChapaCheckout(options: {
  getMerchantChapaCredentials: (input: {
    tenantId: string;
    requireOnlineEnabled?: boolean;
  }) => Promise<
    | { ok: true; secretKey: string; providerAccountRef: string | null }
    | { ok: false; error: "merchant_chapa_not_configured" }
  >;
  medusaInternalUrl: string;
  medusaPublishableKeyId: string;
  medusaStoreFetch: typeof fetch;
  recordAnalyticsEvent?: (input: {
    eventType: string;
    idempotencyKey?: string | null;
    properties?: unknown;
    source: "medusa" | "platform" | "storefront";
    subjectId?: string | null;
    subjectType?: string | null;
    tenantId: string;
  }) => Promise<{ ok: boolean }>;
  recordNotificationEvent?: (input: {
    eventType: string;
    payload?: unknown;
    tenantId: string;
  }) => Promise<unknown>;
  request: Request;
  tenantId: string;
}) {
  let body: Record<string, unknown>;
  try {
    body = await getOptionalJsonObjectBody(options.request);
  } catch {
    return Response.json({ error: "invalid_chapa_complete_request" }, { status: 400 });
  }

  const cartId = getStringValue(body.cartId);
  const clientTxRef =
    getStringValue(body.txRef) ??
    getStringValue(body.trx_ref) ??
    getStringValue(body.tx_ref) ??
    null;

  if (!cartId) {
    return Response.json({ error: "invalid_chapa_complete_request" }, { status: 400 });
  }

  const credentials = await options.getMerchantChapaCredentials({
    tenantId: options.tenantId,
    requireOnlineEnabled: true,
  });

  if (!credentials.ok) {
    return Response.json({ error: "merchant_chapa_not_configured" }, { status: 409 });
  }

  const cartResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      medusaInternalUrl: options.medusaInternalUrl,
      method: "GET",
      path: `/store/carts/${encodeURIComponent(cartId)}`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!cartResponse.ok) {
    return new Response(cartResponse.body, {
      headers: cartResponse.headers,
      status: cartResponse.status,
      statusText: cartResponse.statusText,
    });
  }

  const cartBody = await getJsonResponseBody(cartResponse);
  const cart = getObjectValue(getObjectValue(cartBody)?.cart) ?? getObjectValue(cartBody);
  const metadata = getObjectValue(cart?.metadata) ?? {};
  const metadataTxRef =
    getStringValue(metadata.chapa_tx_ref) ?? getStringValue(metadata.chapaTxRef) ?? null;
  const txRef = clientTxRef ?? metadataTxRef;

  if (!txRef) {
    return Response.json({ error: "chapa_tx_ref_missing" }, { status: 409 });
  }

  // If client sent a tx_ref, it must match cart metadata when metadata is present.
  if (metadataTxRef && clientTxRef && metadataTxRef !== clientTxRef) {
    return Response.json({ error: "chapa_tx_ref_mismatch" }, { status: 409 });
  }

  const chapa = createChapaPaymentService({
    secretKey: credentials.secretKey,
  });

  let verification: Awaited<ReturnType<typeof chapa.verifyPayment>>;
  try {
    verification = await chapa.verifyPayment(txRef);
  } catch {
    return Response.json({ error: "chapa_verification_failed" }, { status: 502 });
  }

  if (!verification) {
    return Response.json({ error: "chapa_payment_not_found" }, { status: 404 });
  }

  const verifiedStatus =
    getStringValue(getObjectValue(verification.data)?.status) ??
    getStringValue(verification.status) ??
    "pending";

  if (!isChapaPaidStatus(verifiedStatus)) {
    return Response.json(
      {
        error: "chapa_payment_not_paid",
        status: verifiedStatus,
      },
      { status: 402 },
    );
  }

  const paymentCollectionResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {
        cart_id: cartId,
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: "/store/payment-collections",
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!paymentCollectionResponse.ok) {
    return new Response(paymentCollectionResponse.body, {
      headers: paymentCollectionResponse.headers,
      status: paymentCollectionResponse.status,
      statusText: paymentCollectionResponse.statusText,
    });
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
          payment_method: "chapa",
          chapa_tx_ref: txRef,
          chapa_verified_status: verifiedStatus,
        },
      },
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/payment-collections/${encodeURIComponent(paymentCollectionId)}/payment-sessions`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!paymentSessionResponse.ok) {
    return new Response(paymentSessionResponse.body, {
      headers: paymentSessionResponse.headers,
      status: paymentSessionResponse.status,
      statusText: paymentSessionResponse.statusText,
    });
  }

  const completeCartResponse = await options.medusaStoreFetch(
    getMedusaStoreJsonRequest({
      body: {},
      medusaInternalUrl: options.medusaInternalUrl,
      path: `/store/carts/${encodeURIComponent(cartId)}/complete`,
      publishableKey: options.medusaPublishableKeyId,
    }),
  );

  if (!completeCartResponse.ok) {
    return new Response(completeCartResponse.body, {
      headers: completeCartResponse.headers,
      status: completeCartResponse.status,
      statusText: completeCartResponse.statusText,
    });
  }

  const completeCartBody = await getJsonResponseBody(completeCartResponse);
  const orderId = getCompletedOrderId(completeCartBody);

  if (orderId && options.recordAnalyticsEvent) {
    try {
      await options.recordAnalyticsEvent({
        eventType: "order.created",
        idempotencyKey: `chapa:${txRef}:order.created`,
        properties: {
          cartId,
          orderId,
          paymentMethod: "chapa",
          txRef,
        },
        source: "platform",
        subjectId: orderId,
        subjectType: "order",
        tenantId: options.tenantId,
      });
    } catch {
      // non-blocking
    }
  }

  if (orderId && options.recordNotificationEvent) {
    try {
      await options.recordNotificationEvent({
        eventType: "order.created",
        payload: {
          cartId,
          orderId,
          paymentMethod: "chapa",
          txRef,
        },
        tenantId: options.tenantId,
      });
      await options.recordNotificationEvent({
        eventType: "payment.paid",
        payload: {
          cartId,
          orderId,
          paymentMethod: "chapa",
          txRef,
        },
        tenantId: options.tenantId,
      });
    } catch {
      // non-blocking
    }
  }

  return Response.json(completeCartBody, {
    status: completeCartResponse.status,
    statusText: completeCartResponse.statusText,
  });
}
