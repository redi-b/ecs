import { NextResponse } from "next/server";

import { createTenantShop } from "@/lib/platform-onboarding";

export async function POST(request: Request) {
  const formData = await request.formData();
  const shopName = getRequiredString(formData, "shopName");
  const handle = getRequiredString(formData, "handle");
  const templateKey = getRequiredString(formData, "templateKey");
  const businessCategory = getOptionalString(formData, "businessCategory");
  const contactPhone = getOptionalString(formData, "contactPhone");
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader) {
    return redirectToOnboarding(request, "auth_required", formData);
  }

  if (!shopName || !handle || !templateKey) {
    return redirectToOnboarding(request, "missing_required_fields", formData);
  }

  const createResult = await createTenantShop({
    cookieHeader,
    input: {
      ...(businessCategory ? { businessCategory } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      handle,
      name: shopName,
      templateKey,
    },
    platformApiBaseUrl: getPlatformBaseUrl(),
  });

  if (!createResult.ok) {
    // Surface the platform error code in server logs — the browser only sees the mapped message.
    console.error("[onboarding/submit] shop create failed", {
      handle,
      message: createResult.message,
      status: createResult.status,
    });
    return redirectToOnboarding(request, createResult.message, formData);
  }

  const dashboardUrl =
    createResult.mutation.redirectTo ??
    `http://${createResult.mutation.tenant.primaryDomain.hostname}/admin`;

  return NextResponse.redirect(dashboardUrl, { status: 303 });
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function redirectToOnboarding(request: Request, error: string, formData: FormData) {
  const url = new URL("/admin/onboarding", getRequestOrigin(request));

  url.searchParams.set("error", error);
  for (const key of ["shopName", "handle", "businessCategory", "contactPhone"]) {
    const value = getOptionalString(formData, key);

    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(url, { status: 303 });
}

function getPlatformBaseUrl() {
  return normalizeBaseUrl(process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000");
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
