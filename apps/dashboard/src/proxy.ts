import { type NextRequest, NextResponse } from "next/server";

import { DASHBOARD_PATH_HEADER } from "@/lib/dashboard-auth";

const excludedAdminPrefixes = [
  "/admin/onboarding",
  "/admin/sign-in",
  "/admin/sign-up",
  "/admin/session",
  "/admin/storefront/template",
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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
  matcher: ["/admin/:path*"],
};
