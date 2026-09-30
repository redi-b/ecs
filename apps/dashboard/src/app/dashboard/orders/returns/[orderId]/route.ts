import { createMerchantReturn } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withMerchantAction(request, async (context) => {
    const idempotencyKey = context.request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return { ok: false, message: "idempotency_key_required", status: 400 };
    }
    const body = (await context.request.json().catch(() => null)) as {
      items?: unknown;
      note?: unknown;
    } | null;
    const items = Array.isArray(body?.items)
      ? body.items.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          if (typeof value.lineItemId !== "string" || typeof value.quantity !== "number") return [];
          return [
            {
              lineItemId: value.lineItemId,
              quantity: value.quantity,
              ...(typeof value.note === "string" ? { note: value.note } : {}),
            },
          ];
        })
      : [];
    if (!items.length || items.length !== (Array.isArray(body?.items) ? body.items.length : 0)) {
      return { ok: false, message: "order_return_invalid", status: 400 };
    }
    const result = await createMerchantReturn({
      cookieHeader: context.cookieHeader,
      idempotencyKey,
      items,
      ...(typeof body?.note === "string" && body.note.trim() ? { note: body.note.trim() } : {}),
      orderId,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });
    return result.ok
      ? { ok: true, data: { return: result.orderReturn }, status: 201 }
      : { ok: false, message: result.message, status: result.status };
  });
}
