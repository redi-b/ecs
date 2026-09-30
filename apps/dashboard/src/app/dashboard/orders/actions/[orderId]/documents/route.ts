import type { MerchantSalesDocumentKind } from "@ecs/contracts";
import { issueMerchantSalesDocument } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

const kinds = new Set<MerchantSalesDocumentKind>([
  "order_summary",
  "payment_receipt",
  "packing_slip",
]);

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return withMerchantAction(request, async (action) => {
    if (action.tenantId)
      return { ok: false, message: "selected_tenant_documents_unavailable", status: 400 };
    const body = (await action.request.json().catch(() => undefined)) as
      | { kind?: unknown; language?: unknown }
      | undefined;
    const kind = typeof body?.kind === "string" ? body.kind : "";
    if (!kinds.has(kind as MerchantSalesDocumentKind))
      return { ok: false, message: "invalid_sales_document", status: 400 };
    const result = await issueMerchantSalesDocument({
      cookieHeader: action.cookieHeader,
      idempotencyKey: action.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      kind: kind as MerchantSalesDocumentKind,
      language: body?.language === "am" ? "am" : "en",
      orderId,
      platformApiBaseUrl: action.platformApiBaseUrl,
      requestHost: action.requestHost,
    });
    return result.ok
      ? { ok: true, data: { document: result.document } }
      : { ok: false, message: result.message, status: result.status };
  });
}
