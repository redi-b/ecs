import { updateStorefrontInquiryStatus, type StorefrontInquiryStatus } from "@/lib/platform-api/inquiries/client";
import { withMerchantAction } from "@/lib/platform-api/action-route";

const statuses = new Set<StorefrontInquiryStatus>(["new", "read", "resolved", "archived"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status as StorefrontInquiryStatus : "";
    if (!statuses.has(status as StorefrontInquiryStatus)) return { ok: false, message: "invalid_inquiry_status", status: 400 };
    const result = await updateStorefrontInquiryStatus({ inquiryId, status: status as StorefrontInquiryStatus, cookieHeader: context.cookieHeader, platformApiBaseUrl: context.platformApiBaseUrl, requestHost: context.requestHost, tenantId: context.tenantId });
    return result.ok ? { ok: true, data: { inquiry: result.inquiry } } : result;
  });
}
