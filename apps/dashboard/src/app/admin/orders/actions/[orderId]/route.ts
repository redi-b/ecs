import { type MerchantOrderAction, mutateMerchantOrder } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

const ORDER_ACTIONS = new Set<MerchantOrderAction>([
  "cancel",
  "complete",
  "deliver",
  "fulfill",
  "mark-paid",
  "recheck-payment",
  "finish",
]);

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      action?: unknown;
      fulfillmentId?: unknown;
      markPaid?: unknown;
    };
    const action = typeof body.action === "string" ? body.action : "";

    if (!ORDER_ACTIONS.has(action as MerchantOrderAction)) {
      return {
        ok: false,
        message: "order_action_invalid",
        status: 400,
      };
    }

    if (action === "deliver" && typeof body.fulfillmentId !== "string") {
      return {
        ok: false,
        message: "order_fulfillment_not_found",
        status: 404,
      };
    }

    const result = await mutateMerchantOrder({
      action: action as MerchantOrderAction,
      cookieHeader: context.cookieHeader,
      fulfillmentId: typeof body.fulfillmentId === "string" ? body.fulfillmentId : undefined,
      markPaid: body.markPaid === true,
      orderId,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: result.status,
      };
    }

    return {
      ok: true,
      data: { order: result.order },
    };
  });
}
