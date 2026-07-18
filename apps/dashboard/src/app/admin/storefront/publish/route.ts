import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPlatformApiBaseUrl } from "@/lib/platform-api";
import { publishStorefrontDraft } from "@/lib/storefront-templates";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let tenantId = "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { tenantId?: unknown } | null;
    tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  } else {
    const formData = await request.formData();
    const raw = formData.get("tenantId");
    tenantId = typeof raw === "string" ? raw.trim() : "";
  }

  if (!tenantId) {
    return NextResponse.json({ ok: false, message: "missing_tenant" }, { status: 400 });
  }

  const result = await publishStorefrontDraft({
    cookieHeader,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    tenantId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status >= 400 ? result.status : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "storefront_published",
    storefront: result.publish,
  });
}
