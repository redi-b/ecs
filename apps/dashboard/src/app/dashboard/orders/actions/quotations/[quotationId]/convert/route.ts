import { convertMerchantQuotation } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quotationId: string }> },
) {
  const { quotationId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as { confirmChanges?: unknown };
    const result = await convertMerchantQuotation({
      confirmChanges: body.confirmChanges === true,
      cookieHeader: context.cookieHeader,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      platformApiBaseUrl: context.platformApiBaseUrl,
      quotationId,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { orderId: result.orderId } }
      : { ok: false, message: result.message, status: result.status };
  });
}
