import { type NextRequest, NextResponse } from "next/server";

import { DASHBOARD_PATH_HEADER } from "@/lib/dashboard-auth";
import { getDashboardPublicUrl, isLegacyCentralDashboardHost } from "@/lib/dashboard-hosts";

const excludedDashboardPrefixes = [
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/session",
  "/dashboard/storefront/template",
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

  if (!isDashboardPath(pathname) || isExcludedDashboardPath(pathname)) {
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

function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isExcludedDashboardPath(pathname: string) {
  return excludedDashboardPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: ["/:path*"],
};
