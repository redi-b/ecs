import {
  type MerchantBillingStatus,
  merchantBillingResponseSchema,
  platformErrorSchema,
} from "@ecs/contracts";

import { getPlatformApiBaseUrl, createPlatformHeaders } from "@/lib/platform-api/client";

export type MerchantBillingResult =
  | {
      ok: true;
      billing: MerchantBillingStatus;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

/**
 * Dedicated billing status for the Billing page.
 * Prefer this over getMerchantDashboardSummary (which also loads ops + analytics).
 */
export async function getMerchantBillingStatus(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl?: string | null | undefined;
  tenantId: string;
}): Promise<MerchantBillingResult> {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    return { ok: false, status: 400, message: "billing_tenant_required" };
  }

  const fetcher = options.fetcher ?? fetch;
  const baseUrl = getPlatformApiBaseUrl(options.platformApiBaseUrl);
  const url = new URL(
    `platform/tenants/${encodeURIComponent(tenantId)}/billing`,
    baseUrl,
  );

  const headers = createPlatformHeaders({
    cookieHeader: options.cookieHeader,
  });
  headers.set("accept", "application/json");

  const response = await fetcher(url, {
    cache: "no-store",
    headers,
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
      message: error.success ? error.data.error : response.statusText || "Billing request failed",
    };
  }

  const parsed = merchantBillingResponseSchema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[merchant-billing] schema mismatch",
        parsed.error.flatten(),
        parsed.error.issues.slice(0, 8),
      );
    }
    return {
      ok: false,
      status: 502,
      message: "invalid_billing_response",
    };
  }

  return {
    ok: true,
    billing: parsed.data.billing,
  };
}
