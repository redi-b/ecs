import {
  type DeliverySettings,
  deliverySettingsSchema,
  platformErrorSchema,
  type PlatformTenant,
  platformTenantMutationSchema,
} from "@ecs/contracts";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export type MerchantSettingsResult =
  | {
      ok: true;
      redirectTo: string | null;
      tenant: PlatformTenant;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantDeliverySettingsResult =
  | ({
      ok: true;
    } & DeliverySettings)
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantSettingsInput = {
  handle: string;
  name: string;
};

export type MerchantDeliverySettingsInput = {
  currency: string;
  defaultDeliveryFee: string;
  deliveryEnabled: boolean;
  landmarkRequired: boolean;
  notesEnabled: boolean;
  phoneConfirmationRequired: boolean;
  pickupEnabled: boolean;
  zones: unknown[];
};

export async function updateMerchantSettings(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  settings: MerchantSettingsInput;
  tenantId?: string | null | undefined;
}): Promise<MerchantSettingsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getSettingsUrl(options), {
    body: JSON.stringify(options.settings),
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: (error.success ? error.data.error : response.statusText || "Settings update failed"),
    };
  }

  const parsed = platformTenantMutationSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_settings_response",
    };
  }

  return {
    ok: true,
    redirectTo: parsed.data.redirectTo ?? null,
    tenant: parsed.data.tenant,
  };
}

export async function getMerchantDeliverySettings(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}): Promise<MerchantDeliverySettingsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getDeliveryUrl(options), {
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
    }),
  }).catch(() => null);

  return parseDeliveryResponse(response);
}

export async function updateMerchantDeliverySettings(options: {
  cookieHeader?: string | null | undefined;
  delivery: MerchantDeliverySettingsInput;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}): Promise<MerchantDeliverySettingsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getDeliveryUrl(options), {
    body: JSON.stringify(options.delivery),
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
    }),
    method: "POST",
  }).catch(() => null);

  return parseDeliveryResponse(response);
}

async function parseDeliveryResponse(
  response: Response | null,
): Promise<MerchantDeliverySettingsResult> {
  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: (error.success ? error.data.error : response.statusText || "Delivery request failed"),
    };
  }

  const parsed = deliverySettingsSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_delivery_response",
    };
  }

  return {
    ok: true,
    ...parsed.data,
  };
}

function getSettingsUrl(options: {
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/settings`
    : "/platform/merchant/settings";

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getDeliveryUrl(options: {
  platformApiBaseUrl: string;
  tenantId: string;
}) {
  return new URL(
    `/platform/tenants/${encodeURIComponent(options.tenantId)}/delivery`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}


function getDashboardHeaders(options: {
  cookieHeader?: string | null | undefined;
  requestHost?: string | null | undefined;
}) {
  return createPlatformHeaders({
    contentType: "json",
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}
