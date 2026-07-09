import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPlatformApiBaseUrl, getRequestOrigin } from "@/lib/platform-api";
import { selectStorefrontTemplate } from "@/lib/storefront-templates";

export async function POST(request: Request) {
  const formData = await request.formData();
  const tenantId = formData.get("tenantId");
  const templateKey = formData.get("templateKey");
  const returnTo = formData.get("returnTo");
  const safeReturnTo = typeof returnTo === "string" ? getSafeReturnTo(returnTo) : "/admin";

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return redirectToAdmin(request, "missing_tenant", null, safeReturnTo);
  }

  if (typeof templateKey !== "string" || !templateKey.trim()) {
    return redirectToAdmin(request, "missing_template", tenantId, safeReturnTo);
  }

  const cookieStore = await cookies();
  const result = await selectStorefrontTemplate({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    tenantId: tenantId.trim(),
    templateKey: templateKey.trim(),
  });

  if (!result.ok) {
    return redirectToAdmin(request, result.message, tenantId, safeReturnTo);
  }

  return redirectToAdmin(request, "template_selected", tenantId, safeReturnTo);
}

function redirectToAdmin(
  request: Request,
  status: string,
  tenantId?: string | null,
  path = "/admin",
) {
  const url = new URL(path, getRequestOrigin(request));

  url.searchParams.set("templateStatus", status);

  if (tenantId?.trim()) {
    url.searchParams.set("tenantId", tenantId.trim());
  }

  return NextResponse.redirect(url, { status: 303 });
}

function getSafeReturnTo(value: string) {
  if (!value.startsWith("/admin")) {
    return "/admin";
  }

  if (value.startsWith("//") || value.includes("://")) {
    return "/admin";
  }

  return value;
}
