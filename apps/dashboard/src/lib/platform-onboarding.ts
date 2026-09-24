import {
  type PlatformHandleAvailability,
  type PlatformOnboardingState,
  type PlatformTenant,
  type PlatformTenantMutation,
  type PlatformTenants,
  platformErrorSchema,
  platformHandleAvailabilitySchema,
  platformOnboardingStateSchema,
  platformTenantCreateRequestSchema,
  platformTenantDetailSchema,
  platformTenantMutationSchema,
  platformTenantsSchema,
  type StorefrontTemplateCatalogItem,
} from "@ecs/contracts";

export type PlatformOnboardingResult =
  | {
      ok: true;
      state: PlatformOnboardingState;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type TenantHandleAvailabilityResult =
  | {
      ok: true;
      availability: PlatformHandleAvailability;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type TenantCreateResult =
  | {
      ok: true;
      mutation: PlatformTenantMutation;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type TenantCreateInput = {
  shopDetails?: import("@ecs/contracts").ShopDetails;
  businessCategory?: string | undefined;
  contactPhone?: string | undefined;
  handle: string;
  name: string;
  templateId?: string | undefined;
  templateKey?: string | undefined;
};

export type PlatformTenantsResult =
  | { ok: true; tenants: PlatformTenant[] }
  | { ok: false; message: string; status: number };

export async function getPlatformTenant(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}) {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL(
      `/platform/tenants/${encodeURIComponent(options.tenantId)}`,
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    { cache: "no-store", headers: getJsonHeaders(options.cookieHeader) },
  ).catch(() => null);
  if (!response) return { message: "platform_request_failed", ok: false as const, status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return getPlatformError(response, data, "Shop request failed");
  const parsed = platformTenantDetailSchema.safeParse(data);
  if (!parsed.success) {
    return { message: "invalid_tenant_response", ok: false as const, status: 502 };
  }
  return { ok: true as const, tenant: parsed.data.tenant };
}

export async function getAllPlatformTenants(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
}): Promise<PlatformTenantsResult> {
  const fetcher = options.fetcher ?? fetch;
  const tenants: PlatformTenant[] = [];
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const url = new URL("/platform/tenants", normalizeBaseUrl(options.platformApiBaseUrl));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const response = await fetcher(url, {
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
    }).catch(() => null);
    if (!response) return { message: "platform_request_failed", ok: false, status: 503 };

    const data = await response.json().catch(() => undefined);
    if (!response.ok) return getPlatformError(response, data, "Shop list request failed");
    const parsed = platformTenantsSchema.safeParse(data);
    if (!parsed.success) {
      return { message: "invalid_tenant_list_response", ok: false, status: 502 };
    }

    const page: PlatformTenants = parsed.data;
    tenants.push(...page.tenants);
    if (tenants.length >= page.count || page.tenants.length === 0) break;
  }

  return { ok: true, tenants };
}

export async function getPlatformOnboardingState(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
}): Promise<PlatformOnboardingResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/onboarding/state", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Onboarding state request failed");
  }

  const parsed = platformOnboardingStateSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_onboarding_state_response",
    };
  }

  return {
    ok: true,
    state: parsed.data,
  };
}

export async function checkTenantHandleAvailability(options: {
  fetcher?: typeof fetch;
  handle: string;
  platformApiBaseUrl: string;
}): Promise<TenantHandleAvailabilityResult> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(
    "/platform/tenants/handle-availability",
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
  url.searchParams.set("handle", options.handle);
  const response = await fetcher(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
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
    return getPlatformError(response, data, "Handle availability request failed");
  }

  const parsed = platformHandleAvailabilitySchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_handle_availability_response",
    };
  }

  return {
    ok: true,
    availability: parsed.data,
  };
}

export async function createTenantShop(options: {
  cookieHeader: string;
  fetcher?: typeof fetch;
  input: TenantCreateInput;
  platformApiBaseUrl: string;
}): Promise<TenantCreateResult> {
  const parsedInput = platformTenantCreateRequestSchema.safeParse(options.input);

  if (!parsedInput.success) {
    return {
      ok: false,
      status: 400,
      message: "invalid_shop_setup",
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    new URL("/platform/tenants", normalizeBaseUrl(options.platformApiBaseUrl)),
    {
      body: JSON.stringify(parsedInput.data),
      cache: "no-store",
      headers: getJsonHeaders(options.cookieHeader),
      method: "POST",
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return getPlatformError(response, data, "Tenant creation request failed");
  }

  const parsed = platformTenantMutationSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_tenant_creation_response",
    };
  }

  return {
    ok: true,
    mutation: parsed.data,
  };
}

export function getPreferredTemplate(templates: StorefrontTemplateCatalogItem[]) {
  return templates[0] ?? null;
}

function getJsonHeaders(cookieHeader?: string | null | undefined) {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });

  if (cookieHeader?.trim()) {
    headers.set("cookie", cookieHeader.trim());
  }

  return headers;
}

function getPlatformError(response: Response, data: unknown, fallbackMessage: string) {
  const error = platformErrorSchema.safeParse(data);

  return {
    ok: false,
    status: response.status,
    message: error.success ? error.data.error : response.statusText || fallbackMessage,
  } as const;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
