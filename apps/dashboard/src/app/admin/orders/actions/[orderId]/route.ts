import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { mutateMerchantOrder, type MerchantOrderAction } from "@/lib/merchant-orders";

const ORDER_ACTIONS = new Set<MerchantOrderAction>(["cancel", "complete", "deliver", "fulfill"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    fulfillmentId?: unknown;
  };
  const action = typeof body.action === "string" ? body.action : "";

  if (!ORDER_ACTIONS.has(action as MerchantOrderAction)) {
    return NextResponse.json({ error: "order_action_invalid" }, { status: 400 });
  }

  if (action === "deliver" && typeof body.fulfillmentId !== "string") {
    return NextResponse.json({ error: "order_fulfillment_not_found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await mutateMerchantOrder({
    action: action as MerchantOrderAction,
    cookieHeader: cookieStore.toString(),
    fulfillmentId: typeof body.fulfillmentId === "string" ? body.fulfillmentId : undefined,
    orderId,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ order: result.order });
}
