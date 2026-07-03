import { NextResponse, type NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "@/lib/dashboard-auth";

const excludedAdminPrefixes = [
  "/admin/sign-in",
  "/admin/session",
  "/admin/storefront/template",
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin") || isExcludedAdminPath(pathname)) {
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

function isExcludedAdminPath(pathname: string) {
  return excludedAdminPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: ["/admin/:path*"],
};
