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
      settlementMethod?: unknown;
      bankCode?: unknown;
      bankName?: unknown;
      accountLast4?: unknown;
      accountLabel?: unknown;
      receivingAccountId?: unknown;
      reference?: unknown;
      note?: unknown;
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

    const settlement =
      typeof body.settlementMethod === "string"
        ? {
            settlementMethod: body.settlementMethod,
            ...(typeof body.bankCode === "string" ? { bankCode: body.bankCode } : {}),
            ...(typeof body.bankName === "string" ? { bankName: body.bankName } : {}),
            ...(typeof body.accountLast4 === "string" ? { accountLast4: body.accountLast4 } : {}),
            ...(typeof body.accountLabel === "string" ? { accountLabel: body.accountLabel } : {}),
            ...(typeof body.receivingAccountId === "string"
              ? { receivingAccountId: body.receivingAccountId }
              : {}),
            ...(typeof body.reference === "string" ? { reference: body.reference } : {}),
            ...(typeof body.note === "string" ? { note: body.note } : {}),
          }
        : undefined;

    if (action === "mark-paid" && !settlement) {
      return {
        ok: false,
        message: "settlement_method_required",
        status: 400,
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
      settlement,
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
