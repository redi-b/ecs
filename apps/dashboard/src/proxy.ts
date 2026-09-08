import { type NextRequest, NextResponse } from "next/server";

import { DASHBOARD_PATH_HEADER } from "@/lib/dashboard-auth";
import { getDashboardPublicUrl, isLegacyCentralDashboardHost } from "@/lib/dashboard-hosts";

const excludedAdminPrefixes = [
  "/admin/onboarding",
  "/admin/sign-in",
  "/admin/sign-up",
  "/admin/session",
  "/admin/storefront/template",
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    isLegacyCentralDashboardHost(
      request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        request.nextUrl.host,
    )
  ) {
    const canonical = getDashboardPublicUrl();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = canonical.protocol;
    redirectUrl.hostname = canonical.hostname;
    redirectUrl.port = canonical.port;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (!isAdminPath(pathname) || isExcludedAdminPath(pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DASHBOARD_PATH_HEADER, `${pathname}${search}`);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isExcludedAdminPath(pathname: string) {
  return excludedAdminPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: ["/:path*"],
};
