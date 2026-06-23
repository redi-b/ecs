import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { selectStorefrontTemplate } from "../../../../lib/storefront-templates";

export async function POST(request: Request) {
  const formData = await request.formData();
  const tenantId = formData.get("tenantId");
  const templateKey = formData.get("templateKey");

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return redirectToAdmin(request, "missing_tenant");
  }

  if (typeof templateKey !== "string" || !templateKey.trim()) {
    return redirectToAdmin(request, "missing_template");
  }

  const cookieStore = await cookies();
  const result = await selectStorefrontTemplate({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    tenantId: tenantId.trim(),
    templateKey: templateKey.trim(),
  });

  if (!result.ok) {
    return redirectToAdmin(request, result.message);
  }

  return redirectToAdmin(request, "template_selected");
}

function redirectToAdmin(request: Request, status: string) {
  const url = new URL("/admin", getRequestOrigin(request));

  url.searchParams.set("templateStatus", status);

  return NextResponse.redirect(url, { status: 303 });
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}
