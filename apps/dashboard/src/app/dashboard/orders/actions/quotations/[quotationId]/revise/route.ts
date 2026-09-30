import { reviseMerchantQuotation } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quotationId: string }> },
) {
  const { quotationId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => undefined)) as
      | { draftId?: unknown; expectedRevision?: unknown; language?: unknown }
      | undefined;
    const draftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";
    const expectedRevision = Number(body?.expectedRevision);
    if (!draftId || !Number.isInteger(expectedRevision) || expectedRevision < 1)
      return { ok: false, message: "invalid_quotation", status: 400 };
    const result = await reviseMerchantQuotation({
      cookieHeader: context.cookieHeader,
      draftId,
      expectedRevision,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      language: body?.language === "am" ? "am" : "en",
      platformApiBaseUrl: context.platformApiBaseUrl,
      quotationId,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { quotation: result.quotation } }
      : { ok: false, message: result.message, status: result.status };
  });
}
