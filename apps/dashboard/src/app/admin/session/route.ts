import { NextResponse } from "next/server";

import {
  createDashboardSession,
  dashboardSessionCookieName,
  dashboardSessionMaxAgeSeconds,
  getDashboardSessionSecret,
} from "../../../lib/dashboard-session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const nextPath = getSafeNextPath(formData.get("next"));

  if (typeof email !== "string" || !email.trim()) {
    const url = getRedirectUrl("/admin/sign-in", request);

    url.searchParams.set("error", "missing_email");
    url.searchParams.set("next", nextPath);

    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(getRedirectUrl(nextPath, request), { status: 303 });

  response.cookies.set({
    httpOnly: true,
    maxAge: dashboardSessionMaxAgeSeconds,
    name: dashboardSessionCookieName,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: createDashboardSession({
      email,
      secret: getDashboardSessionSecret(),
    }),
  });

  return response;
}

function getSafeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}

function getRedirectUrl(path: string, request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(path, request.url);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return new URL(path, `${forwardedProto}://${forwardedHost}`);
}
