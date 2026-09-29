import { merchantExpenseInputSchema } from "@ecs/contracts";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { createMerchantExpense } from "@/lib/platform-api/expenses";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (context.tenantId) {
      return { ok: false, message: "selected_tenant_expenses_unavailable", status: 400 };
    }
    const parsed = merchantExpenseInputSchema.safeParse(
      await context.request.json().catch(() => undefined),
    );
    if (!parsed.success) return { ok: false, message: "invalid_expense", status: 400 };
    const result = await createMerchantExpense({
      cookieHeader: context.cookieHeader,
      expense: parsed.data,
      idempotencyKey: context.request.headers.get("idempotency-key")?.trim() || "",
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    return result.ok
      ? { ok: true, data: { expense: result.expense }, status: 201 }
      : { ok: false, message: result.message, status: result.status };
  });
}
