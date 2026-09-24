import { storefrontLanguageSettingsSchema } from "@ecs/contracts";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getStorefrontDraft, updateStorefrontDraft } from "@/lib/platform-api/storefront/templates";

export async function GET(request: Request) {
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/dashboard/storefront/translations", request.url));
  }
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const requestedTenantId = new URL(request.url).searchParams.get("tenantId") ?? undefined;
  const access = await getMerchantDashboardAccessShell({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId: requestedTenantId,
  });
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }
  const draft = await getStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    tenantId: access.access.tenant.id,
  });
  if (!draft.ok) {
    return NextResponse.json({ message: draft.message }, { status: draft.status });
  }
  return NextResponse.json({ enabledLocales: draft.draft.languageSettings.enabledLocales });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  const parsed = storefrontLanguageSettingsSchema.safeParse(body?.languageSettings);
  if (!tenantId || !parsed.success) {
    return NextResponse.json({ message: "invalid_language_settings" }, { status: 400 });
  }

  const cookieHeader = (await cookies()).toString();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const draft = await getStorefrontDraft({ cookieHeader, platformApiBaseUrl, tenantId });
  if (!draft.ok) {
    return NextResponse.json({ message: draft.message }, { status: draft.status });
  }
  const updated = await updateStorefrontDraft({
    cookieHeader,
    data: draft.draft.data,
    languageSettings: parsed.data,
    localizedContent: draft.draft.localizedContent,
    platformApiBaseUrl,
    tenantId,
    themeTokens: draft.draft.themeTokens,
  });
  if (!updated.ok) {
    return NextResponse.json({ message: updated.message }, { status: updated.status });
  }
  return NextResponse.json({ languageSettings: updated.draft.languageSettings });
}
