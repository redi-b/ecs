import { type NextRequest, NextResponse } from "next/server";

import { isOpsHost } from "@/lib/ops-host";

export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!isOpsHost(host)) {
    return new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
