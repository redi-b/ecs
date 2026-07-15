import {
  type MerchantDashboardAccess,
  type MerchantDashboardSummary,
  merchantDashboardAccessSchema,
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

export type MerchantDashboardAccessResult =
  | {
      ok: true;
      access: MerchantDashboardAccess;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

/**
 * Full overview payload (ops, analytics, billing).
 * Use on Overview only — Billing has getMerchantBillingStatus; Settings/Editor use the access shell.
 */
export async function getMerchantDashboardSummary(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDashboardResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getMerchantDashboardUrl(options, "full"), {
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
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
      message: error.success ? error.data.error : response.statusText || "Dashboard request failed",
    };
  }

  const parsed = merchantDashboardSummarySchema.safeParse(data);

  if (!parsed.success) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[merchant-dashboard] summary schema mismatch",
        parsed.error.flatten(),
        parsed.error.issues.slice(0, 8),
      );
    }
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

/** Lean shell for layout auth — no Medusa order sampling or billing. */
export async function getMerchantDashboardAccessShell(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDashboardAccessResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getMerchantDashboardUrl(options, "access"), {
    cache: "no-store",
    headers: getDashboardHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
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
      message: error.success ? error.data.error : response.statusText || "Dashboard access failed",
    };
  }

  const parsed = merchantDashboardAccessSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_dashboard_access_response",
    };
  }

  return {
    ok: true,
    access: parsed.data,
  };
}

function getMerchantDashboardUrl(
  options: {
    platformApiBaseUrl: string;
    tenantId?: string | null | undefined;
  },
  mode: "full" | "access",
) {
  const tenantId = options.tenantId?.trim();
  const path = tenantId
    ? mode === "access"
      ? `/platform/tenants/${encodeURIComponent(tenantId)}/dashboard/access`
      : `/platform/tenants/${encodeURIComponent(tenantId)}/dashboard`
    : mode === "access"
      ? "/platform/merchant/dashboard/access"
      : "/platform/merchant/dashboard";

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
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
