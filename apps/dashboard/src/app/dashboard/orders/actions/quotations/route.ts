import { issueMerchantQuotation } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (context.tenantId)
      return { ok: false, message: "selected_tenant_quotations_unavailable", status: 400 };
    const body = (await context.request.json().catch(() => undefined)) as
      | { draftId?: unknown; language?: unknown }
      | undefined;
    const draftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";
    const language = body?.language === "am" ? "am" : "en";
    if (!draftId) return { ok: false, message: "invalid_quotation", status: 400 };
    const result = await issueMerchantQuotation({
      cookieHeader: context.cookieHeader,
      draftId,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      language,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { quotation: result.quotation } }
      : { ok: false, message: result.message, status: result.status };
  });
}
