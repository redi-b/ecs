import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPlatformApiBaseUrl, getRequestOrigin } from "@/lib/platform-api";
import { selectStorefrontTemplate } from "@/lib/storefront-templates";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const contentType = request.headers.get("content-type") ?? "";
  const wantsJson =
    contentType.includes("application/json") ||
    (request.headers.get("accept") ?? "").includes("application/json");

  let tenantId = "";
  let templateKey = "";
  let returnTo = "/admin";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      tenantId?: unknown;
      templateKey?: unknown;
      returnTo?: unknown;
    } | null;
    tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
    templateKey = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
    if (typeof body?.returnTo === "string") {
      returnTo = getSafeReturnTo(body.returnTo);
    }
  } else {
    const formData = await request.formData();
    const rawTenant = formData.get("tenantId");
    const rawTemplate = formData.get("templateKey");
    const rawReturn = formData.get("returnTo");
    tenantId = typeof rawTenant === "string" ? rawTenant.trim() : "";
    templateKey = typeof rawTemplate === "string" ? rawTemplate.trim() : "";
    if (typeof rawReturn === "string") {
      returnTo = getSafeReturnTo(rawReturn);
    }
  }

  if (!tenantId) {
    return wantsJson
      ? NextResponse.json({ ok: false, message: "missing_tenant" }, { status: 400 })
      : redirectToAdmin(request, "missing_tenant", null, returnTo);
  }

  if (!templateKey) {
    return wantsJson
      ? NextResponse.json({ ok: false, message: "missing_template" }, { status: 400 })
      : redirectToAdmin(request, "missing_template", tenantId, returnTo);
  }

  const result = await selectStorefrontTemplate({
    cookieHeader,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    tenantId,
    templateKey,
  });

  if (!result.ok) {
    return wantsJson
      ? NextResponse.json({ ok: false, message: result.message }, { status: result.status })
      : redirectToAdmin(request, result.message, tenantId, returnTo);
  }

  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      message: "template_selected",
      selection: result.selection,
    });
  }

  return redirectToAdmin(request, "template_selected", tenantId, returnTo);
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
