import { platformErrorSchema } from "@ecs/contracts";

import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export type MerchantChapaStatus = {
  configured: boolean;
  onlineEnabled: boolean;
  credentialsValidated: boolean;
  secretFingerprint: string | null;
  status: string;
};

export type MerchantPaymentsStatus = {
  cod: true;
  chapa: MerchantChapaStatus;
};

export type MerchantPaymentsResult =
  | { ok: true; payment: MerchantPaymentsStatus }
  | { ok: false; message: string; status: number };

export type MerchantPaymentsMutationResult =
  | { ok: true; payment?: MerchantPaymentsStatus; fingerprint?: string; message?: string }
  | { ok: false; message: string; status: number };

function headers(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
}) {
  return createPlatformHeaders({
    contentType: "json",
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

async function parseError(response: Response, data: unknown, fallback: string) {
  const error = platformErrorSchema.safeParse(data);
  const message =
    error.success
      ? error.data.error
      : typeof data === "object" &&
          data &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : response.statusText || fallback;
  return { ok: false as const, status: response.status, message };
}

export async function getMerchantPaymentsStatus(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
}): Promise<MerchantPaymentsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/merchant/payments", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      cache: "no-store",
      headers: headers(options),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data, "Payments status failed");
  }

  const payment =
    data && typeof data === "object" && "payment" in data
      ? (data as { payment: MerchantPaymentsStatus }).payment
      : null;

  if (!payment?.chapa) {
    return { ok: false, status: 502, message: "invalid_payments_response" };
  }

  return { ok: true, payment };
}

export async function setMerchantChapaCredentials(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
  secretKey: string;
  onlineEnabled?: boolean;
}): Promise<MerchantPaymentsMutationResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL(
      "/platform/merchant/payments/chapa/credentials",
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    {
      body: JSON.stringify({
        secretKey: options.secretKey,
        onlineEnabled: options.onlineEnabled === true,
      }),
      cache: "no-store",
      headers: headers(options),
      method: "POST",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data, "Could not save Chapa credentials");
  }

  const result: MerchantPaymentsMutationResult = { ok: true };
  if (data && typeof data === "object" && "fingerprint" in data) {
    result.fingerprint = String((data as { fingerprint: string }).fingerprint);
  }
  if (data && typeof data === "object" && "payment" in data) {
    result.payment = (data as { payment: MerchantPaymentsStatus }).payment;
  }
  return result;
}

export async function testMerchantChapaCredentials(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
  secretKey?: string;
}): Promise<MerchantPaymentsMutationResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/merchant/payments/chapa/test", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      body: JSON.stringify(options.secretKey ? { secretKey: options.secretKey } : {}),
      cache: "no-store",
      headers: headers(options),
      method: "POST",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data, "Chapa key check failed");
  }

  return { ok: true, message: "chapa_credentials_valid" };
}

export async function setMerchantChapaOnlineEnabled(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  onlineEnabled: boolean;
  platformApiBaseUrl: string;
  requestHost?: string | null;
}): Promise<MerchantPaymentsMutationResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/merchant/payments/chapa", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      body: JSON.stringify({ onlineEnabled: options.onlineEnabled }),
      cache: "no-store",
      headers: headers(options),
      method: "PATCH",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data, "Could not update online payments");
  }

  const result: MerchantPaymentsMutationResult = { ok: true };
  if (data && typeof data === "object" && "payment" in data) {
    result.payment = (data as { payment: MerchantPaymentsStatus }).payment;
  }
  return result;
}

export async function clearMerchantChapaCredentials(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
}): Promise<MerchantPaymentsMutationResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL(
      "/platform/merchant/payments/chapa/credentials",
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    {
      cache: "no-store",
      headers: headers(options),
      method: "DELETE",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data, "Could not remove Chapa credentials");
  }

  return { ok: true };
}
