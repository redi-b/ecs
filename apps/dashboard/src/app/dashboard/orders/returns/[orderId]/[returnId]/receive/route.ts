import { receiveMerchantReturn } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string; returnId: string }> },
) {
  const { orderId, returnId } = await params;
  return withMerchantAction(request, async (context) => {
    const idempotencyKey = context.request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return { ok: false, message: "idempotency_key_required", status: 400 };
    }
    const body = (await context.request.json().catch(() => null)) as { items?: unknown } | null;
    if (!Array.isArray(body?.items)) {
      return { ok: false, message: "order_return_invalid", status: 400 };
    }
    const result = await receiveMerchantReturn({
      cookieHeader: context.cookieHeader,
      idempotencyKey,
      items: body.items as Array<{
        damagedQuantity: number;
        lineItemId: string;
        sellableQuantity: number;
      }>,
      orderId,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      returnId,
      tenantId: context.tenantId,
    });
    return result.ok
      ? { ok: true, data: { return: result.orderReturn }, status: 200 }
      : { ok: false, message: result.message, status: result.status };
  });
}
