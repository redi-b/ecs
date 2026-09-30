import type {
  MerchantExpense,
  MerchantExpenseCategory,
  MerchantExpenseInput,
} from "@ecs/contracts";
import { type createPlatformDb, merchantExpenses, merchantOrderCostSnapshots } from "@ecs/db";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

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
  q?: string | undefined;
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
      if (input.q) {
        const escaped = input.q.replace(/[\\%_]/g, "\\$&");
        const pattern = `%${escaped}%`;
        const search = or(
          ilike(merchantExpenses.vendorLabel, pattern),
          ilike(merchantExpenses.reference, pattern),
          ilike(merchantExpenses.note, pattern),
        );
        if (search) predicates.push(search);
      }
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

export type MerchantOrderCostSnapshotInput = {
  currencyCode: string;
  lineItemId: string;
  orderId: string;
  orderPlacedAt: string;
  quantity: number;
  tenantId: string;
  unitCostAmount: number | null;
  variantId: string | null;
};

export function createMerchantOrderCostSnapshotStore(db: PlatformDatabase) {
  return {
    async capture(input: { items: MerchantOrderCostSnapshotInput[]; tenantId: string }) {
      if (!input.items.length) return { captured: 0 };
      const rows = await db
        .insert(merchantOrderCostSnapshots)
        .values(
          input.items.map((item) => ({
            ...item,
            tenantId: input.tenantId,
            orderPlacedAt: new Date(item.orderPlacedAt),
          })),
        )
        .onConflictDoNothing()
        .returning({ id: merchantOrderCostSnapshots.id });
      return { captured: rows.length };
    },
    async list(input: { orderIds: string[]; tenantId: string }) {
      if (!input.orderIds.length) return [];
      return db
        .select({
          orderId: merchantOrderCostSnapshots.orderId,
          quantity: merchantOrderCostSnapshots.quantity,
          unitCostAmount: merchantOrderCostSnapshots.unitCostAmount,
        })
        .from(merchantOrderCostSnapshots)
        .where(
          and(
            eq(merchantOrderCostSnapshots.tenantId, input.tenantId),
            inArray(merchantOrderCostSnapshots.orderId, input.orderIds),
          ),
        );
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

export function summarizeEstimatedProfit(input: {
  expenses: number;
  orders: Array<{
    currencyCode?: string | null | undefined;
    id: string;
    paymentStatus?: string | null | undefined;
    refundedTotal?: number | undefined;
    status?: string | null | undefined;
    total?: number | null | undefined;
  }>;
  snapshots: Array<{ orderId: string; quantity: number; unitCostAmount: number | null }>;
}) {
  const recognized = input.orders.filter((order) => {
    const payment = order.paymentStatus?.trim().toLowerCase();
    const status = order.status?.trim().toLowerCase();
    return (
      status !== "canceled" &&
      status !== "cancelled" &&
      order.currencyCode?.trim().toLowerCase() === "etb" &&
      (payment === "captured" ||
        payment === "paid" ||
        payment === "partially_refunded" ||
        payment === "refunded")
    );
  });
  const recognizedIds = new Set(recognized.map((order) => order.id));
  const snapshots = input.snapshots.filter((snapshot) => recognizedIds.has(snapshot.orderId));
  const missingOrderIds = new Set(
    snapshots
      .filter((snapshot) => snapshot.unitCostAmount === null)
      .map((snapshot) => snapshot.orderId),
  );
  for (const order of recognized) {
    if (!snapshots.some((snapshot) => snapshot.orderId === order.id)) missingOrderIds.add(order.id);
  }
  const result = calculateEstimatedProfit({
    expenses: input.expenses,
    knownProductCost: snapshots.reduce(
      (total, snapshot) => total + (snapshot.unitCostAmount ?? 0) * snapshot.quantity,
      0,
    ),
    recordedRefunds: recognized.reduce(
      (total, order) => total + Math.max(order.refundedTotal ?? 0, 0),
      0,
    ),
    recognizedSales: recognized.reduce((total, order) => total + Math.max(order.total ?? 0, 0), 0),
    ordersMissingCost: missingOrderIds.size,
  });
  return {
    ...result,
    excludedOrders: input.orders.length - recognized.length,
    recognizedOrders: recognized.length,
  };
}

export async function getMerchantEstimatedProfit(input: {
  from: string;
  listCosts: (input: {
    orderIds: string[];
    tenantId: string;
  }) => Promise<Array<{ orderId: string; quantity: number; unitCostAmount: number | null }>>;
  listExpenses: ReturnType<typeof createMerchantExpenseStore>["list"];
  listOrders: (
    input: import("../../types/merchant-order.js").MerchantOrderListQuery,
  ) => Promise<import("../../types/merchant-order.js").MerchantOrdersResult>;
  salesChannelId: string;
  tenantId: string;
  to: string;
}) {
  const orders: import("../../types/merchant-order.js").MerchantOrder[] = [];
  let offset = 0;
  let count = 0;
  do {
    const page = await input.listOrders({
      createdFrom: `${input.from}T00:00:00+03:00`,
      createdTo: `${input.to}T23:59:59.999+03:00`,
      limit: 100,
      offset,
      paymentStatus: "paid",
      salesChannelId: input.salesChannelId,
    });
    if (!page.ok) return page;
    count = page.count;
    if (count > 10_000) {
      return {
        error: "estimated_profit_range_too_large" as const,
        ok: false as const,
        status: 413 as const,
      };
    }
    orders.push(...page.orders);
    offset += page.orders.length;
    if (!page.orders.length && offset < count) {
      return {
        error: "estimated_profit_source_incomplete" as const,
        ok: false as const,
        status: 503 as const,
      };
    }
  } while (offset < count);

  const [snapshots, expensePage] = await Promise.all([
    input.listCosts({ orderIds: orders.map((order) => order.id), tenantId: input.tenantId }),
    input.listExpenses({
      from: input.from,
      limit: 1,
      offset: 0,
      status: "active",
      tenantId: input.tenantId,
      to: input.to,
    }),
  ]);
  return {
    computedAt: new Date().toISOString(),
    currencyCode: "etb" as const,
    from: input.from,
    ok: true as const,
    summary: summarizeEstimatedProfit({
      expenses: expensePage.totalAmount / 100,
      orders,
      snapshots,
    }),
    to: input.to,
  };
}
