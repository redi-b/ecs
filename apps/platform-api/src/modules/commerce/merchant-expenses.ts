import type {
  MerchantExpense,
  MerchantExpenseCategory,
  MerchantExpenseInput,
} from "@ecs/contracts";
import { type createPlatformDb, merchantExpenses } from "@ecs/db";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];
type ExpenseRow = typeof merchantExpenses.$inferSelect;

function mapExpense(row: ExpenseRow): MerchantExpense {
  return {
    actorUserId: row.actorUserId,
    amount: row.amount,
    category: row.category as MerchantExpenseCategory,
    createdAt: row.createdAt.toISOString(),
    currencyCode: row.currencyCode,
    id: row.id,
    note: row.note,
    occurredOn: row.occurredOn,
    reference: row.reference,
    status: row.status as MerchantExpense["status"],
    tenantId: row.tenantId,
    updatedAt: row.updatedAt.toISOString(),
    vendorLabel: row.vendorLabel,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedByUserId: row.voidedByUserId,
  };
}

export type MerchantExpenseListInput = {
  category?: MerchantExpenseCategory | undefined;
  from?: string | undefined;
  limit: number;
  offset: number;
  status?: "active" | "void" | undefined;
  tenantId: string;
  to?: string | undefined;
};

export type MerchantExpenseStore = ReturnType<typeof createMerchantExpenseStore>;

export function createMerchantExpenseStore(db: PlatformDatabase) {
  return {
    async create(input: MerchantExpenseInput & { actorUserId: string; tenantId: string }) {
      const [row] = await db.insert(merchantExpenses).values(input).returning();
      if (!row) throw new Error("expense_create_failed");
      return { expense: mapExpense(row) };
    },
    async list(input: MerchantExpenseListInput) {
      const predicates = [eq(merchantExpenses.tenantId, input.tenantId)];
      if (input.status) predicates.push(eq(merchantExpenses.status, input.status));
      if (input.category) predicates.push(eq(merchantExpenses.category, input.category));
      if (input.from) predicates.push(gte(merchantExpenses.occurredOn, input.from));
      if (input.to) predicates.push(lte(merchantExpenses.occurredOn, input.to));
      const where = and(...predicates);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(merchantExpenses)
          .where(where)
          .orderBy(desc(merchantExpenses.occurredOn), desc(merchantExpenses.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({
            count: count(),
            total: sql<number>`coalesce(sum(case when ${merchantExpenses.status} = 'active' then ${merchantExpenses.amount} else 0 end), 0)`,
          })
          .from(merchantExpenses)
          .where(where),
      ]);
      return {
        count: totals[0]?.count ?? 0,
        expenses: rows.map(mapExpense),
        limit: input.limit,
        offset: input.offset,
        totalAmount: Number(totals[0]?.total ?? 0),
      };
    },
    async void(input: { actorUserId: string; expenseId: string; tenantId: string }) {
      const now = new Date();
      const [row] = await db
        .update(merchantExpenses)
        .set({ status: "void", updatedAt: now, voidedAt: now, voidedByUserId: input.actorUserId })
        .where(
          and(
            eq(merchantExpenses.id, input.expenseId),
            eq(merchantExpenses.tenantId, input.tenantId),
            eq(merchantExpenses.status, "active"),
          ),
        )
        .returning();
      if (row) return { ok: true as const, expense: mapExpense(row) };
      const [existing] = await db
        .select()
        .from(merchantExpenses)
        .where(
          and(
            eq(merchantExpenses.id, input.expenseId),
            eq(merchantExpenses.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      return existing?.status === "void"
        ? { ok: true as const, expense: mapExpense(existing) }
        : { ok: false as const, error: "expense_not_found" as const, status: 404 as const };
    },
  };
}

export function calculateEstimatedProfit(input: {
  expenses: number;
  knownProductCost: number;
  recordedRefunds: number;
  recognizedSales: number;
  ordersMissingCost: number;
}) {
  return {
    amount: input.recognizedSales - input.recordedRefunds - input.knownProductCost - input.expenses,
    coverage: input.ordersMissingCost === 0 ? ("complete" as const) : ("partial" as const),
    ...input,
  };
}
