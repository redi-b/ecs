import { NextResponse } from "next/server";

import { createPlatformHeaders, createPlatformUrl } from "@/lib/platform-api";
import { getPlatformTenant } from "@/lib/platform-onboarding";
import { getSharedParentCookieDomain } from "@/lib/shared-cookie-domain";
import { getShopDashboardUrl, isAvailableShop, LAST_SHOP_COOKIE_NAME } from "@/lib/shop-selection";

type InvitationError = "accept" | "account" | "expired" | "verify";

export function invitationErrorFromResponse(payload: unknown): InvitationError {
  const candidate = payload as {
    code?: unknown;
    error?: { code?: unknown };
    message?: unknown;
  } | null;
  const code = [candidate?.code, candidate?.error?.code, candidate?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toUpperCase();

  if (code.includes("NOT_THE_RECIPIENT")) return "account";
  if (code.includes("EMAIL_VERIFICATION_REQUIRED")) return "verify";
  if (code.includes("INVITATION_NOT_FOUND") || code.includes("INVITATION_EXPIRED")) {
    return "expired";
  }
  return "accept";
}

function browserOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host");
  if (!host) return new URL(request.url).origin;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function invitationPageUrl(
  origin: string,
  invitationId: string,
  error: InvitationError,
  tenantId?: string,
) {
  const url = new URL("/accept-invitation", origin);
  url.searchParams.set("invitationId", invitationId);
  if (tenantId) url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("error", error);
  return url;
}

export async function POST(request: Request) {
  const publicOrigin = browserOrigin(request);
  const formData = await request.formData();
  const invitationId = formData.get("invitationId");
  const tenantId = formData.get("tenantId");
  if (typeof invitationId !== "string" || !invitationId.trim()) {
    return NextResponse.redirect(new URL("/accept-invitation?error=invalid", publicOrigin), 303);
  }

  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const platformHeaders = createPlatformHeaders({
    contentType: "json",
    cookieHeader: request.headers.get("cookie"),
    requestHost,
  });
  if (requestHost) {
    platformHeaders.set(
      "origin",
      `${request.headers.get("x-forwarded-proto") ?? "http"}://${requestHost}`,
    );
  }
  const response = await fetch(
    createPlatformUrl(
      "/platform/auth/organization/accept-invitation",
      process.env.PLATFORM_API_BASE_URL,
    ),
    {
      body: JSON.stringify({ invitationId: invitationId.trim() }),
      cache: "no-store",
      headers: platformHeaders,
      method: "POST",
    },
  ).catch(() => null);

  if (!response?.ok) {
    const error = response
      ? invitationErrorFromResponse(await response.json().catch(() => null))
      : "accept";
    return NextResponse.redirect(
      invitationPageUrl(
        publicOrigin,
        invitationId.trim(),
        error,
        typeof tenantId === "string" ? tenantId.trim() : undefined,
      ),
      303,
    );
  }

  if (typeof tenantId === "string" && tenantId.trim()) {
    const tenant = await getPlatformTenant({
      cookieHeader: request.headers.get("cookie"),
      platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
      tenantId: tenantId.trim(),
    });
    if (tenant.ok && isAvailableShop(tenant.tenant)) {
      const protocol = new URL(publicOrigin).protocol.replace(":", "");
      const redirect = NextResponse.redirect(
        getShopDashboardUrl(tenant.tenant.primaryDomain.hostname, protocol),
        303,
      );
      const domain = getSharedParentCookieDomain({
        hostname: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      });
      redirect.cookies.set(LAST_SHOP_COOKIE_NAME, tenant.tenant.id, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
        secure: protocol === "https",
        ...(domain ? { domain } : {}),
      });
      return redirect;
    }
  }

  return NextResponse.redirect(new URL("/admin/shops", publicOrigin), 303);
}
