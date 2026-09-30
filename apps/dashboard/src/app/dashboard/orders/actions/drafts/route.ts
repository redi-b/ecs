import type { MerchantSaleDraftContent } from "@ecs/contracts";
import { saveMerchantSaleDraft } from "@/lib/merchant-orders";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (context.tenantId) {
      return { ok: false, message: "selected_tenant_sale_drafts_unavailable", status: 400 };
    }
    const content = (await context.request.json().catch(() => undefined)) as
      | MerchantSaleDraftContent
      | undefined;
    if (!content) return { ok: false, message: "invalid_sale_draft", status: 400 };
    const result = await saveMerchantSaleDraft({
      content,
      cookieHeader: context.cookieHeader,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || crypto.randomUUID(),
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { draft: result.draft } }
      : { ok: false, message: result.message, status: result.status };
  });
}
