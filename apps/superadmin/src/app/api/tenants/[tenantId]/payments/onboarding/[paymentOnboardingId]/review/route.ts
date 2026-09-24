import { headers } from "next/headers";

import { reviewSuperadminPayment } from "@/lib/platform-api/superadmin/commerce-review";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentOnboardingId: string; tenantId: string }> },
) {
  const { paymentOnboardingId, tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status =
    body.status === "approved" || body.status === "needs_review" || body.status === "rejected"
      ? body.status
      : null;
  if (!status || typeof body.reason !== "string") {
    return Response.json({ error: "payment_review_invalid" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await reviewSuperadminPayment({
    cookieHeader: requestHeaders.get("cookie"),
    paymentOnboardingId,
    tenantId,
    reason: body.reason,
    status,
    ...(typeof body.providerAccountRef === "string"
      ? { providerAccountRef: body.providerAccountRef }
      : {}),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
