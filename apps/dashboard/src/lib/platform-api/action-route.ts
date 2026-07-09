import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appendTenantRedirectParams } from "@/lib/dashboard-tenant-context";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

export type MerchantActionContext = {
  cookieHeader: string;
  platformApiBaseUrl: string;
  request: Request;
  requestHost: string | null;
  tenantId: string | null;
  wantsJson: boolean;
};

export type MerchantActionResult =
  | {
      ok: true;
      data?: unknown;
      redirectPath?: string;
      redirectStatusParam?: string;
      status?: number;
    }
  | {
      ok: false;
      message: string;
      status: number;
      redirectPath?: string;
      redirectStatusParam?: string;
    };

/**
 * Thin helper for dashboard mutation route handlers.
 * Captures cookies/host/base URL and standardizes JSON vs redirect responses.
 */
export async function withMerchantAction(
  request: Request,
  handler: (context: MerchantActionContext) => Promise<MerchantActionResult>,
) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const tenantId = new URL(request.url).searchParams.get("tenantId");

  const result = await handler({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    request,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId,
    wantsJson,
  });

  // Prefer JSON for API-style action routes. Redirect only when explicitly requested.
  const shouldRedirect = Boolean(result.redirectPath) && !wantsJson;

  if (!shouldRedirect) {
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.data ?? { ok: true }, { status: result.status ?? 200 });
  }

  const statusParam = result.redirectStatusParam ?? (result.ok ? "ok" : result.message);
  return redirectWithStatus(request, result.redirectPath ?? "/admin", statusParam);
}

export function redirectWithStatus(request: Request, path: string, status: string) {
  const url = new URL(path, getRequestOrigin(request));
  const statusKey = path.includes("/products")
    ? "productStatus"
    : path.includes("/orders")
      ? "orderStatus"
      : "status";

  url.searchParams.set(statusKey, status);
  appendTenantRedirectParams(url, request);

  return NextResponse.redirect(url, { status: 303 });
}

export function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}
