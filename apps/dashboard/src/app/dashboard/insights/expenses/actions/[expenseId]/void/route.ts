import { withMerchantAction } from "@/lib/platform-api/action-route";
import { voidMerchantExpense } from "@/lib/platform-api/expenses";

export async function POST(request: Request, context: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await context.params;
  return withMerchantAction(request, async (action) => {
    if (action.tenantId) {
      return { ok: false, message: "selected_tenant_expenses_unavailable", status: 400 };
    }
    const result = await voidMerchantExpense({
      cookieHeader: action.cookieHeader,
      expenseId,
      idempotencyKey: action.request.headers.get("idempotency-key")?.trim() || "",
      platformApiBaseUrl: action.platformApiBaseUrl,
      requestHost: action.requestHost,
    });
    return result.ok ? { ok: true } : { ok: false, message: result.message, status: result.status };
  });
}
