import {
  platformErrorSchema,
  type StorefrontSeoSettings,
  storefrontSeoSettingsResponseSchema,
} from "@ecs/contracts";
import { platformFetch } from "@/lib/platform-api/client";

export type StorefrontSeoResult =
  | { ok: true; seo: StorefrontSeoSettings }
  | { ok: false; message: string; status: number };

export async function getStorefrontSeoSettings(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId: string;
}): Promise<StorefrontSeoResult> {
  return requestSeo(options, "GET");
}

export async function updateStorefrontSeoSettings(options: {
  cookieHeader?: string | null;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  seo: StorefrontSeoSettings;
  tenantId: string;
}): Promise<StorefrontSeoResult> {
  return requestSeo(options, "PATCH");
}

async function requestSeo(
  options: {
    cookieHeader?: string | null;
    fetcher?: typeof fetch;
    platformApiBaseUrl: string;
    seo?: StorefrontSeoSettings;
    tenantId: string;
  },
  method: "GET" | "PATCH",
): Promise<StorefrontSeoResult> {
  const response = await platformFetch(
    `/platform/tenants/${encodeURIComponent(options.tenantId)}/storefront/seo`,
    {
      ...(method === "PATCH" ? { body: JSON.stringify({ seo: options.seo }) } : {}),
      contentType: "json",
      cookieHeader: options.cookieHeader,
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
      method,
      platformApiBaseUrl: options.platformApiBaseUrl,
    },
  );
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      message: error.success ? error.data.error : "storefront_seo_failed",
      status: response.status,
    };
  }
  const parsed = storefrontSeoSettingsResponseSchema.safeParse(data);
  return parsed.success
    ? { ok: true, seo: parsed.data.seo }
    : { ok: false, message: "invalid_storefront_seo_response", status: 502 };
}
