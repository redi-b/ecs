import { NextResponse } from "next/server";
import { getPlatformTenant } from "@/lib/platform-onboarding";
import { getSharedParentCookieDomain } from "@/lib/shared-cookie-domain";
import { getShopDashboardUrl, isAvailableShop, LAST_SHOP_COOKIE_NAME } from "@/lib/shop-selection";

export async function POST(request: Request) {
  const form = await request.formData();
  const tenantId = form.get("tenantId");
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return redirectToPicker(request, "invalid_shop");
  }

  const result = await getPlatformTenant({
    cookieHeader: request.headers.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    tenantId,
  });
  if (!result.ok || !isAvailableShop(result.tenant)) {
    return redirectToPicker(request, result.ok ? "shop_unavailable" : "shop_not_found");
  }

  const protocol = getPublicProtocol(request);
  const response = NextResponse.redirect(
    getShopDashboardUrl(result.tenant.primaryDomain.hostname, protocol),
    { status: 303 },
  );
  const domain = getSharedParentCookieDomain({
    hostname: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
  response.cookies.set(LAST_SHOP_COOKIE_NAME, result.tenant.id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: protocol === "https",
    ...(domain ? { domain } : {}),
  });
  return response;
}

function redirectToPicker(request: Request, error: string) {
  const url = new URL("/dashboard/shops", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function getPublicProtocol(request: Request) {
  const configured = process.env.DASHBOARD_PUBLIC_BASE_URL;
  if (configured) return new URL(configured).protocol.replace(":", "");
  return (request.headers.get("x-forwarded-proto") ?? "http").split(",", 1)[0]?.trim() ?? "http";
}
