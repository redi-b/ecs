import { merchantExpenseCategorySchema, merchantExpenseInputSchema } from "@ecs/contracts";
import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  buildExpenseCsv,
  expenseExportFilename,
  MAX_EXPENSE_EXPORT_COUNT,
} from "../../modules/data-transfer/expense-export.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function registerMerchantExpenseRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/expenses", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { insights: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantExpenses) {
      return context.json({ error: "expenses_unavailable" }, 503);
    }
    const category = context.req.query("category");
    const parsedCategory = category ? merchantExpenseCategorySchema.safeParse(category) : null;
    const status = context.req.query("status");
    const from = context.req.query("from");
    const to = context.req.query("to");
    if (
      (parsedCategory && !parsedCategory.success) ||
      (status && status !== "active" && status !== "void") ||
      (from && !isoDate.test(from)) ||
      (to && !isoDate.test(to)) ||
      (from && to && from > to)
    ) {
      return context.json({ error: "invalid_expense_filter" }, 400);
    }
    const result = await options.listMerchantExpenses({
      ...(parsedCategory?.success ? { category: parsedCategory.data } : {}),
      ...(from ? { from } : {}),
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      ...(status === "active" || status === "void" ? { status } : {}),
      tenantId: merchant.result.context.tenantId,
      ...(to ? { to } : {}),
    });
    return context.json(result);
  });

  app.get("/platform/merchant/expenses/estimated-profit", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { insights: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.getMerchantEstimatedProfit) {
      return context.json({ error: "estimated_profit_unavailable" }, 503);
    }
    const from = context.req.query("from") ?? "";
    const to = context.req.query("to") ?? "";
    if (!isoDate.test(from) || !isoDate.test(to) || from > to) {
      return context.json({ error: "invalid_estimated_profit_range" }, 400);
    }
    const commerce = helpers.getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const result = await options.getMerchantEstimatedProfit({
      from,
      salesChannelId: commerce.context.medusaSalesChannelId,
      tenantId: merchant.result.context.tenantId,
      to,
    });
    if (result.ok) return context.json(result);
    if (result.status === 413) return context.json({ error: result.error }, 413);
    if (result.status === 503) return context.json({ error: result.error }, 503);
    return context.json({ error: result.error }, 502);
  });

  app.get("/platform/merchant/expenses/export.csv", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { insights: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantExpenses) {
      return context.json({ error: "expenses_unavailable" }, 503);
    }
    const first = await options.listMerchantExpenses({
      limit: 100,
      offset: 0,
      tenantId: merchant.result.context.tenantId,
    });
    if (first.count > MAX_EXPENSE_EXPORT_COUNT) {
      return context.json({ error: "expense_export_too_large" }, 413);
    }
    const expenses = [...first.expenses];
    for (let offset = first.expenses.length; offset < first.count; offset += 100) {
      const page = await options.listMerchantExpenses({
        limit: 100,
        offset,
        tenantId: merchant.result.context.tenantId,
      });
      if (page.count !== first.count || page.offset !== offset || page.expenses.length === 0) {
        return context.json({ error: "export_results_changed" }, 409);
      }
      expenses.push(...page.expenses);
    }
    return new Response(buildExpenseCsv(expenses), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${expenseExportFilename()}"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  });

  app.post("/platform/merchant/expenses", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { settings: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.createMerchantExpense) {
      return context.json({ error: "expenses_unavailable" }, 503);
    }
    const createExpense = options.createMerchantExpense;
    const parsed = merchantExpenseInputSchema.safeParse(
      await context.req.json().catch(() => undefined),
    );
    if (!parsed.success) return context.json({ error: "invalid_expense" }, 400);
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const create = () =>
      createExpense({
        ...parsed.data,
        actorUserId: merchant.session.user.id,
        tenantId: merchant.result.context.tenantId,
      });
    if (!options.executeMerchantMutation) {
      return context.json({ error: "mutation_replay_unavailable" }, 503);
    }
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "expense.create",
        payload: parsed.data,
        requestId: context.get("requestId"),
        resourceKeys: [`expense-create:${idempotencyKey}`],
        source: "dashboard",
        tenantId: merchant.result.context.tenantId,
      },
      create,
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    return context.json(execution.value, execution.replayed ? 200 : 201);
  });

  app.post("/platform/merchant/expenses/:expenseId/void", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { settings: ["manage"] });
    if (!merchant.ok) return merchant.response;
    if (!options.voidMerchantExpense || !options.executeMerchantMutation) {
      return context.json({ error: "expenses_unavailable" }, 503);
    }
    const voidExpense = options.voidMerchantExpense;
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const expenseId = context.req.param("expenseId");
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "expense.void",
        payload: { expenseId },
        requestId: context.get("requestId"),
        resourceKeys: [`expense:${expenseId}`],
        source: "dashboard",
        tenantId: merchant.result.context.tenantId,
      },
      () =>
        voidExpense({
          actorUserId: merchant.session.user.id,
          expenseId,
          tenantId: merchant.result.context.tenantId,
        }),
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    if (!execution.value.ok) {
      return context.json({ error: execution.value.error }, execution.value.status);
    }
    context.header("x-idempotent-replay", String(execution.replayed));
    return context.json({ expense: execution.value.expense });
  });
}
