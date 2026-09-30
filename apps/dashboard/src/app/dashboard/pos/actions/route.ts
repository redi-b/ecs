import { z } from "zod";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

const requestSchema = z.object({
  completion: z.enum(["paid", "pay_later"]),
  order: z.record(z.string(), z.unknown()),
  reference: z.string().trim().max(240).optional(),
  settlementMethod: z
    .enum(["cash", "telebirr", "cbe_birr", "bank_transfer", "other"])
    .default("cash"),
});

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (context.tenantId) {
      return { message: "selected_tenant_quick_sale_unavailable", ok: false, status: 400 };
    }
    const parsed = requestSchema.safeParse(await context.request.json().catch(() => undefined));
    if (!parsed.success) return { message: "invalid_quick_sale", ok: false, status: 400 };
    const idempotencyKey = context.request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return { message: "idempotency_key_required", ok: false, status: 400 };
    }

    const created = await platformFetch("/platform/merchant/manual-orders", {
      body: JSON.stringify({ ...parsed.data.order, channel: "pos" }),
      contentType: "json",
      cookieHeader: context.cookieHeader,
      headers: { "idempotency-key": `${idempotencyKey}:order` },
      method: "POST",
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    const createData = (await created.json().catch(() => null)) as {
      error?: string;
      order?: { id?: string };
    } | null;
    if (!created.ok || !createData?.order?.id) {
      return {
        message: createData?.error ?? "quick_sale_create_failed",
        ok: false,
        status: created.status || 502,
      };
    }
    if (parsed.data.completion === "pay_later") {
      return { data: { order: createData.order, paymentRecorded: false }, ok: true, status: 201 };
    }

    const paid = await platformFetch(
      `/platform/merchant/orders/${encodeURIComponent(createData.order.id)}/mark-paid`,
      {
        body: JSON.stringify({
          channel: "pos",
          ...(parsed.data.reference ? { reference: parsed.data.reference } : {}),
          settlementMethod: parsed.data.settlementMethod,
        }),
        contentType: "json",
        cookieHeader: context.cookieHeader,
        headers: { "idempotency-key": `${idempotencyKey}:payment` },
        method: "POST",
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
      },
    );
    const paidData = (await paid.json().catch(() => null)) as { error?: string } | null;
    if (!paid.ok) {
      return {
        data: {
          order: createData.order,
          paymentError: paidData?.error ?? "quick_sale_payment_failed",
          paymentRecorded: false,
        },
        ok: true,
        status: 202,
      };
    }
    return { data: { order: createData.order, paymentRecorded: true }, ok: true, status: 201 };
  });
}
