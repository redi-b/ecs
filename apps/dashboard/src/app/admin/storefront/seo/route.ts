import { storefrontSeoSettingsSchema } from "@ecs/contracts";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPlatformApiBaseUrl } from "@/lib/platform-api";
import { updateStorefrontSeoSettings } from "@/lib/platform-api/storefront/seo";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const parsed = storefrontSeoSettingsSchema.safeParse(body?.seo);
  if (!tenantId || !parsed.success) {
    return NextResponse.json({ ok: false, message: "invalid_storefront_seo" }, { status: 422 });
  }
  const result = await updateStorefrontSeoSettings({
    cookieHeader: (await cookies()).toString(),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    seo: parsed.data,
    tenantId,
  });
  return result.ok
    ? NextResponse.json({ ok: true, seo: result.seo })
    : NextResponse.json({ ok: false, message: result.message }, { status: result.status });
}
