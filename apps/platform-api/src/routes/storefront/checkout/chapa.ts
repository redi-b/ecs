type ChapaCheckoutInput = {
  cartId: string;
  returnUrl?: string | null;
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

function getArrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getChapaCheckoutInput(body: Record<string, unknown>): ChapaCheckoutInput | undefined {
  const cartId = getStringValue(body.cartId);

  if (!cartId) {
    return undefined;
  }

  return {
    cartId,
    returnUrl: getStringValue(body.returnUrl) ?? null,
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

function getPaymentSession(data: unknown) {
  const body = getObjectValue(data);
  const directSession = getObjectValue(body?.payment_session);

  if (directSession) {
    return directSession;
  }

  const paymentCollection = getObjectValue(body?.payment_collection);
  const sessions = getArrayValue(paymentCollection?.payment_sessions);

  return getObjectValue(sessions[0]);
}

function getCheckoutUrl(data: unknown) {
  const session = getPaymentSession(data);
  const sessionData = getObjectValue(session?.data);

  return getStringValue(sessionData?.checkout_url);
}

function getPaymentSessionId(data: unknown) {
  return getStringValue(getPaymentSession(data)?.id);
}

function getMedusaPassthroughResponse(response: Response) {
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
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

export async function initializeChapaCheckout(options: {
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
        provider_id: "pp_chapa_chapa",
        data: {
          callback_url: getCallbackUrl({
            platformPublicBaseUrl: options.platformPublicBaseUrl,
            tenantId: options.tenantId,
          }),
          return_url: input.returnUrl ?? getFallbackReturnUrl(options.request),
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

  const paymentSessionBody = await getJsonResponseBody(paymentSessionResponse);
  const checkoutUrl = getCheckoutUrl(paymentSessionBody);

  if (!checkoutUrl) {
    return Response.json({ error: "chapa_checkout_url_unavailable" }, { status: 503 });
  }

  return Response.json({
    checkoutUrl,
    paymentSession: {
      id: getPaymentSessionId(paymentSessionBody),
    },
  });
}
