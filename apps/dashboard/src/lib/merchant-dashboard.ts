import {
  type MerchantDashboardSummary,
  merchantDashboardSummarySchema,
  platformErrorSchema,
} from "@ecs/contracts";

export type MerchantDashboardResult =
  | {
      ok: true;
      summary: MerchantDashboardSummary;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export async function getMerchantDashboardSummary(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
}): Promise<MerchantDashboardResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getMerchantDashboardUrl(options.platformApiBaseUrl), {
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.requestHost,
    }),
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Dashboard request failed",
    };
  }

  const parsed = merchantDashboardSummarySchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_dashboard_response",
    };
  }

  return {
    ok: true,
    summary: parsed.data,
  };
}

function getMerchantDashboardUrl(platformApiBaseUrl: string) {
  return new URL("/platform/merchant/dashboard", normalizeBaseUrl(platformApiBaseUrl));
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function getDashboardHeaders(options: {
  cookieHeader?: string | null | undefined;
  requestHost?: string | null | undefined;
}) {
  const headers = new Headers();

  if (options.cookieHeader?.trim()) {
    headers.set("cookie", options.cookieHeader.trim());
  }

  if (options.requestHost?.trim()) {
    headers.set("x-forwarded-host", options.requestHost.trim());
  }

  return headers;
}
