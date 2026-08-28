import { headers } from "next/headers";

import { updateSuperadminInvoice } from "@/lib/platform-api/superadmin/commerce-review";

export async function POST(
  request: Request,
  context: { params: Promise<{ invoiceId: string; tenantId: string }> },
) {
  const { invoiceId, tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = body.status === "paid" || body.status === "void" ? body.status : null;
  if (!status || typeof body.reason !== "string") {
    return Response.json({ error: "invoice_review_invalid" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await updateSuperadminInvoice({
    cookieHeader: requestHeaders.get("cookie"),
    invoiceId,
    tenantId,
    reason: body.reason,
    status,
    ...(typeof body.provider === "string" ? { provider: body.provider } : {}),
    ...(typeof body.providerReference === "string"
      ? { providerReference: body.providerReference }
      : {}),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
