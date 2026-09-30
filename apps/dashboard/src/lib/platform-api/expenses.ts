import {
  type MerchantExpenseInput,
  merchantExpenseSchema,
  merchantExpensesResponseSchema,
} from "@ecs/contracts";
import { z } from "zod";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

type Context = {
  cookieHeader?: string | null | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
};

function headers(options: Context, json = false) {
  return createPlatformHeaders({
    contentType: json ? "json" : false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

export async function getMerchantExpenses(
  options: Context & { limit?: number; offset?: number; status?: "active" | "void" },
) {
  const url = new URL("/platform/merchant/expenses", normalizeBaseUrl(options.platformApiBaseUrl));
  url.searchParams.set("limit", String(options.limit ?? 50));
  url.searchParams.set("offset", String(options.offset ?? 0));
  if (options.status) url.searchParams.set("status", options.status);
  const response = await fetch(url, { cache: "no-store", headers: headers(options) }).catch(
    () => null,
  );
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    return {
      ok: false as const,
      message: typeof body?.error === "string" ? body.error : "expenses_request_failed",
      status: response.status,
    };
  }
  const parsed = merchantExpensesResponseSchema.safeParse(body);
  return parsed.success
    ? { ok: true as const, data: parsed.data }
    : { ok: false as const, message: "invalid_expenses_response", status: 502 };
}

const estimatedProfitSchema = z.object({
  computedAt: z.string(),
  currencyCode: z.literal("etb"),
  from: z.string(),
  ok: z.literal(true),
  summary: z.object({
    amount: z.number(),
    coverage: z.enum(["complete", "partial"]),
    excludedOrders: z.number().int().nonnegative(),
    expenses: z.number().nonnegative(),
    knownProductCost: z.number().nonnegative(),
    ordersMissingCost: z.number().int().nonnegative(),
    recognizedOrders: z.number().int().nonnegative(),
    recognizedSales: z.number().nonnegative(),
    recordedRefunds: z.number().nonnegative(),
  }),
  to: z.string(),
});
export type MerchantEstimatedProfit = z.infer<typeof estimatedProfitSchema>;

export async function getMerchantEstimatedProfit(options: Context & { from: string; to: string }) {
  const url = new URL(
    "/platform/merchant/expenses/estimated-profit",
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
  url.searchParams.set("from", options.from);
  url.searchParams.set("to", options.to);
  const response = await fetch(url, { cache: "no-store", headers: headers(options) }).catch(
    () => null,
  );
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const body = await response.json().catch(() => null);
  const parsed = estimatedProfitSchema.safeParse(body);
  return response.ok && parsed.success
    ? { data: parsed.data, ok: true as const }
    : {
        message: typeof body?.error === "string" ? body.error : "estimated_profit_request_failed",
        ok: false as const,
        status: response.status || 502,
      };
}

export async function createMerchantExpense(
  options: Context & { expense: MerchantExpenseInput; idempotencyKey: string },
) {
  const requestHeaders = headers(options, true);
  requestHeaders.set("idempotency-key", options.idempotencyKey);
  const response = await fetch(
    new URL("/platform/merchant/expenses", normalizeBaseUrl(options.platformApiBaseUrl)),
    { body: JSON.stringify(options.expense), headers: requestHeaders, method: "POST" },
  ).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const body = await response.json().catch(() => undefined);
  const parsed = merchantExpenseSchema.safeParse(body?.expense);
  return response.ok && parsed.success
    ? { ok: true as const, expense: parsed.data }
    : {
        ok: false as const,
        message: typeof body?.error === "string" ? body.error : "expense_create_failed",
        status: response.status || 502,
      };
}

export async function voidMerchantExpense(
  options: Context & { expenseId: string; idempotencyKey: string },
) {
  const requestHeaders = headers(options, true);
  requestHeaders.set("idempotency-key", options.idempotencyKey);
  const response = await fetch(
    new URL(
      `/platform/merchant/expenses/${encodeURIComponent(options.expenseId)}/void`,
      normalizeBaseUrl(options.platformApiBaseUrl),
    ),
    { headers: requestHeaders, method: "POST" },
  ).catch(() => null);
  if (!response) return { ok: false as const, message: "platform_request_failed", status: 503 };
  const body = await response.json().catch(() => undefined);
  return response.ok
    ? { ok: true as const }
    : {
        ok: false as const,
        message: typeof body?.error === "string" ? body.error : "expense_void_failed",
        status: response.status,
      };
}
