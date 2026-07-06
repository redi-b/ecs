# Merchant Order Management Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade merchant Orders from a basic list into a usable read-first order management surface with table controls and a detail page.

**Architecture:** Reuse the existing dashboard `DataTable`, `RowActionsMenu`, route state, refresh, breadcrumb, and error patterns. Keep Platform API and Medusa workflows unchanged unless a hard contract mismatch blocks read-only order detail rendering.

**Tech Stack:** Next.js App Router, React client components, shadcn table/select/input/checkbox/button/badge primitives, Remix icons through `AppIcons`, TanStack Table v8, `@ecs/contracts`, Node test runner with `tsx`.

---

## File Structure

- Create `apps/dashboard/src/features/orders/order-table-state.ts`: pure order search, lifecycle filter, count, identity, date, and money helpers.
- Create `apps/dashboard/src/features/orders/order-table-state.test.ts`: helper tests.
- Create `apps/dashboard/src/features/orders/order-table-cells.tsx`: order identity, status badges, customer, money, and fulfillment display cells.
- Modify `apps/dashboard/src/features/orders/orders-table.tsx`: upgrade to the products-style `DataTable` with toolbar, filters, selection, row actions, and tenant-aware detail links.
- Modify `apps/dashboard/src/app/admin/(dashboard)/orders/page.tsx`: pass `tenantId`, `totalCount`, and `pageSize` to the upgraded table.
- Modify `apps/dashboard/src/lib/merchant-orders.ts`: add `getMerchantOrder` detail fetcher and shared URL/header helpers.
- Modify `apps/dashboard/src/lib/merchant-orders.test.ts`: add detail fetch tests.
- Modify `apps/dashboard/src/lib/routes.ts`: add order detail route helper.
- Modify `apps/dashboard/src/lib/dashboard-breadcrumbs.ts`: add dynamic order detail breadcrumb behavior.
- Modify `apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts`: cover order detail breadcrumb fallback and label override.
- Create `apps/dashboard/src/features/orders/order-detail.tsx`: read-only order detail sections.
- Create `apps/dashboard/src/app/admin/(dashboard)/orders/[orderId]/page.tsx`: tenant-aware order detail page.

Do not add collections, categories, stock, variants, fulfillment mutations, refunds, or customer management in this plan.

---

### Task 1: Order Table State Helpers

**Files:**
- Create: `apps/dashboard/src/features/orders/order-table-state.ts`
- Create: `apps/dashboard/src/features/orders/order-table-state.test.ts`

- [ ] **Step 1: Write failing tests for search, lifecycle filters, identity, counts, money, and dates**

Create `apps/dashboard/src/features/orders/order-table-state.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "@ecs/contracts";

import {
  filterOrdersForTable,
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
  getOrderSearchText,
  getOrderTableCounts,
  getOrderTotalSortValue,
  normalizeOrderLifecycle,
} from "./order-table-state.js";

const orders: MerchantOrder[] = [
  {
    id: "order_1",
    displayId: 1024,
    email: "buyer@example.com",
    status: "pending",
    paymentStatus: "captured",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "etb",
    total: 1250,
    delivery: {
      choice: "delivery",
      customerName: "Abebe Kebede",
      customerPhone: "0911000000",
      landmark: "Near square",
      notes: null,
    },
    fulfillments: [],
    shippingAddress: undefined,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-02T10:00:00.000Z",
  },
  {
    id: "order_2",
    displayId: null,
    email: null,
    status: "completed",
    paymentStatus: "awaiting",
    fulfillmentStatus: "fulfilled",
    currencyCode: "etb",
    total: null,
    delivery: undefined,
    fulfillments: [{ id: "ful_1", deliveredAt: "2026-07-03T10:00:00.000Z", shippedAt: null, canceledAt: null }],
    shippingAddress: undefined,
    createdAt: null,
    updatedAt: null,
  },
];

describe("order table state", () => {
  it("builds searchable text from order, customer, delivery, payment, and fulfillment fields", () => {
    assert.match(getOrderSearchText(orders[0]), /order_1/);
    assert.match(getOrderSearchText(orders[0]), /1024/);
    assert.match(getOrderSearchText(orders[0]), /buyer@example\.com/);
    assert.match(getOrderSearchText(orders[0]), /abebe kebede/);
    assert.match(getOrderSearchText(orders[0]), /not_fulfilled/);
  });

  it("filters the current page by search and lifecycle", () => {
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "all", query: "abebe" }).map((order) => order.id),
      ["order_1"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "needs_fulfillment", query: "" }).map(
        (order) => order.id,
      ),
      ["order_1"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "fulfilled", query: "" }).map((order) => order.id),
      ["order_2"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "payment_pending", query: "" }).map(
        (order) => order.id,
      ),
      ["order_2"],
    );
  });

  it("normalizes display, money, dates, sort totals, lifecycle, and counts", () => {
    assert.equal(formatOrderDisplayId(orders[0]), "#1024");
    assert.equal(formatOrderDisplayId(orders[1]), "order_2");
    assert.equal(formatOrderMoney(1250, "etb"), "ETB 1,250.00");
    assert.equal(formatOrderMoney(null, "etb"), "Not available");
    assert.equal(formatOrderDate("2026-07-01T10:00:00.000Z"), "Jul 1, 2026");
    assert.equal(formatOrderDate(null), "No date");
    assert.equal(getOrderTotalSortValue(orders[0]), 1250);
    assert.equal(getOrderTotalSortValue(orders[1]), null);
    assert.equal(normalizeOrderLifecycle(orders[0]), "needs_fulfillment");
    assert.deepEqual(
      getOrderTableCounts({
        filteredCount: 1,
        filters: { lifecycle: "fulfilled", query: "" },
        pageCount: 2,
        totalCount: 12,
      }),
      { filteredCount: 1, hasActiveFilter: true, pageCount: 2, totalCount: 12 },
    );
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because the helper module does not exist**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: FAIL with a module resolution error for `order-table-state.js`.

- [ ] **Step 3: Implement the pure helper module**

Create `apps/dashboard/src/features/orders/order-table-state.ts`:

```ts
import type { MerchantOrder } from "@ecs/contracts";

export type OrderLifecycleFilter =
  | "all"
  | "open"
  | "completed"
  | "canceled"
  | "needs_fulfillment"
  | "fulfilled"
  | "payment_pending"
  | "paid";

export type OrderTableFilterInput = {
  lifecycle: OrderLifecycleFilter;
  query: string;
};

export function filterOrdersForTable(orders: MerchantOrder[], input: OrderTableFilterInput) {
  const query = input.query.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesQuery = !query || getOrderSearchText(order).includes(query);
    const matchesLifecycle =
      input.lifecycle === "all" || normalizeOrderLifecycle(order) === input.lifecycle;

    return matchesQuery && matchesLifecycle;
  });
}

export function getOrderSearchText(order: MerchantOrder) {
  return [
    order.id,
    typeof order.displayId === "number" ? String(order.displayId) : null,
    order.email,
    order.status,
    order.paymentStatus,
    order.fulfillmentStatus,
    order.delivery?.customerName,
    order.delivery?.customerPhone,
    order.delivery?.choice,
    order.delivery?.landmark,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function normalizeOrderLifecycle(order: MerchantOrder): OrderLifecycleFilter {
  const status = normalizeStatus(order.status);
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const fulfillmentStatus = normalizeStatus(order.fulfillmentStatus);

  if (status.includes("cancel")) {
    return "canceled";
  }

  if (status.includes("complete")) {
    return "completed";
  }

  if (fulfillmentStatus.includes("fulfilled")) {
    return "fulfilled";
  }

  if (fulfillmentStatus.includes("not_fulfilled") || fulfillmentStatus.includes("requires")) {
    return "needs_fulfillment";
  }

  if (paymentStatus.includes("captured") || paymentStatus.includes("paid")) {
    return "paid";
  }

  if (paymentStatus.includes("awaiting") || paymentStatus.includes("pending")) {
    return "payment_pending";
  }

  return "open";
}

export function getOrderTableCounts(input: {
  filteredCount: number;
  filters: OrderTableFilterInput;
  pageCount: number;
  totalCount: number;
}) {
  const { filters, ...counts } = input;

  return {
    ...counts,
    hasActiveFilter: filters.query.trim().length > 0 || filters.lifecycle !== "all",
  };
}

export function formatOrderDisplayId(order: MerchantOrder) {
  return typeof order.displayId === "number" ? `#${order.displayId}` : order.id;
}

export function getOrderTotalSortValue(order: MerchantOrder) {
  return typeof order.total === "number" ? order.total : null;
}

export function formatOrderMoney(total: number | null, currencyCode: string | null) {
  if (typeof total !== "number") {
    return "Not available";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode?.toUpperCase() || "ETB",
    style: "currency",
  }).format(total);
}

export function formatOrderDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function normalizeStatus(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/orders/order-table-state.ts apps/dashboard/src/features/orders/order-table-state.test.ts
git commit -m "test: add order table state helpers"
```

---

### Task 2: Order Detail Fetcher And Breadcrumb Routes

**Files:**
- Modify: `apps/dashboard/src/lib/merchant-orders.ts`
- Modify: `apps/dashboard/src/lib/merchant-orders.test.ts`
- Modify: `apps/dashboard/src/lib/routes.ts`
- Modify: `apps/dashboard/src/lib/dashboard-breadcrumbs.ts`
- Modify: `apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts`

- [ ] **Step 1: Extend tests for order detail fetch and dynamic breadcrumb labels**

Add tests to `apps/dashboard/src/lib/merchant-orders.test.ts`:

```ts
import { getMerchantOrder } from "./merchant-orders.js";

it("fetches a merchant order detail with session and tenant context", async () => {
  const requested = new Headers();
  let requestedUrl = "";
  const result = await getMerchantOrder({
    cookieHeader: "session=abc",
    fetcher: async (url, init) => {
      requestedUrl = String(url);
      new Headers(init?.headers).forEach((value, key) => requested.set(key, value));

      return Response.json({
        order: {
          id: "order_1",
          displayId: 1024,
          email: "buyer@example.com",
          status: "pending",
          paymentStatus: "captured",
          fulfillmentStatus: "not_fulfilled",
          currencyCode: "etb",
          total: 1250,
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      });
    },
    orderId: "order_1",
    platformApiBaseUrl: "http://platform.local",
    tenantId: "tenant_1",
  });

  assert.equal(requestedUrl, "http://platform.local/platform/tenants/tenant_1/orders/order_1");
  assert.equal(requested.get("cookie"), "session=abc");
  assert.deepEqual(result, {
    ok: true,
    order: {
      id: "order_1",
      displayId: 1024,
      email: "buyer@example.com",
      status: "pending",
      paymentStatus: "captured",
      fulfillmentStatus: "not_fulfilled",
      currencyCode: "etb",
      total: 1250,
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-02T10:00:00.000Z",
    },
  });
});

it("returns an error for invalid order detail responses", async () => {
  const result = await getMerchantOrder({
    fetcher: async () => Response.json({ order: null }),
    orderId: "order_1",
    platformApiBaseUrl: "http://platform.local",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 502,
    message: "invalid_order_response",
  });
});
```

Add tests to `apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts`:

```ts
it("labels order detail pages as a child of orders", () => {
  assert.deepEqual(getDashboardBreadcrumbTrail("/admin/orders/order_1"), [
    { href: "/admin/orders", id: "orders", title: "Orders" },
    { href: "/admin/orders/order_1", id: "order-details", title: "Order details" },
  ]);
});

it("uses order detail label overrides when available", () => {
  assert.deepEqual(getDashboardBreadcrumbTrail("/admin/orders/order_1", { "order-details": "#1024" }), [
    { href: "/admin/orders", id: "orders", title: "Orders" },
    { href: "/admin/orders/order_1", id: "order-details", title: "#1024" },
  ]);
});
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: FAIL because `getMerchantOrder`, `dashboardRoutes.orderDetail`, and order breadcrumb behavior do not exist yet.

- [ ] **Step 3: Implement detail fetcher and route helper**

Modify `apps/dashboard/src/lib/merchant-orders.ts`:

```ts
import type { MerchantOrder, MerchantOrders } from "@ecs/contracts";
import { merchantOrderSchema, merchantOrdersSchema, platformErrorSchema } from "@ecs/contracts";

export type MerchantOrderResult =
  | { ok: true; order: MerchantOrder }
  | { ok: false; message: string; status: number };

export async function getMerchantOrder(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  orderId: string;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantOrderResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getOrderUrl(options), {
    cache: "no-store",
    headers: getOrderHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Order request failed",
    };
  }

  const parsed = merchantOrderSchema.safeParse(data?.order);

  if (!parsed.success) {
    return { ok: false, status: 502, message: "invalid_order_response" };
  }

  return { ok: true, order: parsed.data };
}

function getOrderUrl(options: {
  orderId: string;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const encodedOrderId = encodeURIComponent(options.orderId);
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/orders/${encodedOrderId}`
    : `/platform/merchant/orders/${encodedOrderId}`;

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}
```

Keep the existing `getMerchantOrders` export and reuse the existing `getOrderHeaders` and `normalizeBaseUrl` helpers.

Modify `apps/dashboard/src/lib/routes.ts`:

```ts
export const dashboardRoutes = {
  // existing routes...
  orderDetail: (orderId: string) => `/admin/orders/${encodeURIComponent(orderId)}`,
};
```

- [ ] **Step 4: Implement order breadcrumb behavior**

Modify `apps/dashboard/src/lib/dashboard-breadcrumbs.ts` so order details mirror product details:

```ts
const ordersRoute = appRoutes.find((route) => route.href === dashboardRoutes.orders);

if (ordersRoute && pathname.startsWith(`${dashboardRoutes.orders}/`)) {
  return [
    toBreadcrumb(ordersRoute),
    {
      href: pathname,
      id: "order-details",
      title: labels["order-details"] ?? "Order details",
    },
  ];
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/merchant-orders.ts apps/dashboard/src/lib/merchant-orders.test.ts apps/dashboard/src/lib/routes.ts apps/dashboard/src/lib/dashboard-breadcrumbs.ts apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts
git commit -m "feat: add merchant order detail client"
```

---

### Task 3: Order Table Cells And Upgraded Orders Table

**Files:**
- Create: `apps/dashboard/src/features/orders/order-table-cells.tsx`
- Modify: `apps/dashboard/src/features/orders/orders-table.tsx`
- Modify: `apps/dashboard/src/app/admin/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Create order table cell components**

Create `apps/dashboard/src/features/orders/order-table-cells.tsx`:

```tsx
import type { MerchantOrder } from "@ecs/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
} from "@/features/orders/order-table-state";
import { cn } from "@/lib/utils";

export function OrderIdentityCell({ href, order }: { href: string; order: MerchantOrder }) {
  return (
    <Link className="group flex min-w-36 flex-col gap-1 outline-none" href={href}>
      <span className="font-medium text-foreground transition-colors group-hover:text-primary">
        {formatOrderDisplayId(order)}
      </span>
      <span className="text-xs text-muted-foreground">{formatOrderDate(order.createdAt)}</span>
    </Link>
  );
}

export function OrderCustomerCell({ order }: { order: MerchantOrder }) {
  return (
    <div className="flex min-w-44 flex-col gap-1">
      <span className="text-sm text-foreground">
        {order.delivery?.customerName ?? order.email ?? "No customer"}
      </span>
      <span className="text-xs text-muted-foreground">
        {order.delivery?.customerPhone ?? order.email ?? "No contact captured"}
      </span>
    </div>
  );
}

export function OrderMoneyCell({ order }: { order: MerchantOrder }) {
  return (
    <span className="font-medium text-foreground">
      {formatOrderMoney(order.total, order.currencyCode)}
    </span>
  );
}

export function OrderStatusBadge({ status, tone }: { status: string | null; tone?: "payment" | "fulfillment" | "order" }) {
  const normalized = status?.replaceAll("_", " ").toLowerCase() ?? "unknown";
  const isPositive =
    normalized.includes("paid") ||
    normalized.includes("captured") ||
    normalized.includes("fulfilled") ||
    normalized.includes("complete");
  const isAttention =
    normalized.includes("pending") ||
    normalized.includes("awaiting") ||
    normalized.includes("not fulfilled");

  return (
    <Badge
      className={cn(
        "w-fit capitalize",
        isPositive && "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        isAttention && "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
      variant={isPositive || isAttention ? "outline" : "secondary"}
    >
      {normalized}
    </Badge>
  );
}
```

- [ ] **Step 2: Upgrade `OrdersTable` to use DataTable controls**

Modify `apps/dashboard/src/features/orders/orders-table.tsx`:

```tsx
"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/app/data-table";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OrderCustomerCell,
  OrderIdentityCell,
  OrderMoneyCell,
  OrderStatusBadge,
} from "@/features/orders/order-table-cells";
import {
  filterOrdersForTable,
  getOrderTableCounts,
  getOrderTotalSortValue,
  type OrderLifecycleFilter,
} from "@/features/orders/order-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type OrdersTableProps = {
  orders: MerchantOrder[];
  pageSize: number;
  tenantId?: string | undefined;
  totalCount: number;
};

function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getOrderColumns(tenantId?: string): ColumnDef<MerchantOrder>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible orders"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.displayId ?? row.original.id}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "order",
      accessorFn: (order) => order.displayId ?? order.id,
      header: ({ column }) => <DataTableHeader column={column} title="Order" />,
      cell: ({ row }) => {
        const href = getTenantScopedPath(dashboardRoutes.orderDetail(row.original.id), tenantId);

        return <OrderIdentityCell href={href} order={row.original} />;
      },
    },
    {
      id: "customer",
      accessorFn: (order) => order.email ?? order.delivery?.customerName ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Customer" />,
      cell: ({ row }) => <OrderCustomerCell order={row.original} />,
    },
    {
      id: "total",
      accessorFn: (order) => getOrderTotalSortValue(order),
      header: ({ column }) => <DataTableHeader column={column} title="Total" />,
      cell: ({ row }) => <OrderMoneyCell order={row.original} />,
    },
    {
      accessorKey: "paymentStatus",
      header: ({ column }) => <DataTableHeader column={column} title="Payment" />,
      cell: ({ row }) => <OrderStatusBadge status={row.original.paymentStatus} tone="payment" />,
    },
    {
      accessorKey: "fulfillmentStatus",
      header: ({ column }) => <DataTableHeader column={column} title="Fulfillment" />,
      cell: ({ row }) => <OrderStatusBadge status={row.original.fulfillmentStatus} tone="fulfillment" />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableHeader column={column} title="Created" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdAt ?? "No date"}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const order = row.original;
        const href = getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId);

        return (
          <RowActionsMenu
            actions={[
              { href, label: "View details", type: "link" },
              { type: "separator" },
              { label: "Copy order ID", onSelect: () => copyToClipboard(order.id), type: "button" },
              {
                disabled: !order.email,
                label: "Copy customer email",
                onSelect: () => copyToClipboard(order.email ?? ""),
                type: "button",
              },
            ]}
            label={`Open actions for ${order.displayId ?? order.id}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function OrdersTable({ orders, pageSize, tenantId, totalCount }: OrdersTableProps) {
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<OrderLifecycleFilter>("all");
  void pageSize;

  const filteredOrders = useMemo(
    () => filterOrdersForTable(orders, { lifecycle, query }),
    [orders, lifecycle, query],
  );
  const counts = getOrderTableCounts({
    filteredCount: filteredOrders.length,
    filters: { lifecycle, query },
    pageCount: orders.length,
    totalCount,
  });

  return (
    <DataTable
      bulkActions={(selectedOrders) => (
        <Button
          onClick={() => copyToClipboard(selectedOrders.map((order) => order.id).join("\n"))}
          size="sm"
          type="button"
          variant="outline"
        >
          <AppIcons.copy data-icon="inline-start" />
          Copy IDs
        </Button>
      )}
      columns={getOrderColumns(tenantId)}
      data={filteredOrders}
      emptyMessage="No orders have been placed for this merchant yet."
      filteredEmptyMessage="No orders match the current search or filters."
      getRowId={(order) => order.id}
      isFiltered={counts.hasActiveFilter}
      selectedSummaryLabel={(count) => `order${count === 1 ? "" : "s"} selected`}
      toolbar={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
              <InputGroupAddon>
                <AppIcons.search data-icon="inline-start" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search orders"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search orders"
                value={query}
              />
            </InputGroup>
            <Select onValueChange={(value) => setLifecycle(value as OrderLifecycleFilter)} value={lifecycle}>
              <SelectTrigger aria-label="Filter orders by lifecycle" className="h-10 rounded-full sm:w-52">
                <SelectValue placeholder="Lifecycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All orders</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="needs_fulfillment">Needs fulfillment</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="payment_pending">Payment pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {counts.hasActiveFilter
              ? `${counts.filteredCount} of ${counts.pageCount} on this page`
              : `${counts.pageCount} on this page, ${counts.totalCount} total`}
          </p>
        </div>
      }
    />
  );
}
```

- [ ] **Step 3: Pass page metadata from the orders page**

Modify `apps/dashboard/src/app/admin/(dashboard)/orders/page.tsx`:

```tsx
<OrdersTable
  orders={result.orders.orders}
  pageSize={result.orders.limit}
  tenantId={tenantId}
  totalCount={result.orders.count}
/>
```

- [ ] **Step 4: Run dashboard tests, typecheck, and build**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/orders/order-table-cells.tsx apps/dashboard/src/features/orders/orders-table.tsx apps/dashboard/src/app/admin/'(dashboard)'/orders/page.tsx
git commit -m "feat: upgrade merchant orders table"
```

---

### Task 4: Order Detail Page

**Files:**
- Create: `apps/dashboard/src/features/orders/order-detail.tsx`
- Create: `apps/dashboard/src/app/admin/(dashboard)/orders/[orderId]/page.tsx`

- [ ] **Step 1: Create the read-only order detail component**

Create `apps/dashboard/src/features/orders/order-detail.tsx`:

```tsx
import type { MerchantOrder } from "@ecs/contracts";

import { OrderStatusBadge } from "@/features/orders/order-table-cells";
import { formatOrderDate, formatOrderDisplayId, formatOrderMoney } from "@/features/orders/order-table-state";

export function OrderDetail({ order }: { order: MerchantOrder }) {
  const address = order.shippingAddress;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-[1.35rem] border bg-card/95 p-5 shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-2 border-b pb-4">
          <p className="text-xs uppercase text-muted-foreground">Order</p>
          <h2 className="font-heading text-xl font-semibold">{formatOrderDisplayId(order)}</h2>
          <p className="text-sm text-muted-foreground">Created {formatOrderDate(order.createdAt)}</p>
        </div>
        <div className="grid gap-4 py-5 md:grid-cols-3">
          <DetailField label="Payment" value={<OrderStatusBadge status={order.paymentStatus} tone="payment" />} />
          <DetailField label="Fulfillment" value={<OrderStatusBadge status={order.fulfillmentStatus} tone="fulfillment" />} />
          <DetailField label="Order status" value={<OrderStatusBadge status={order.status} tone="order" />} />
        </div>
        <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
          Item-level order detail will appear here when the merchant order contract includes line
          items. This page does not infer product rows from incomplete data.
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <DetailCard title="Total">
          <p className="text-2xl font-semibold">{formatOrderMoney(order.total, order.currencyCode)}</p>
          <p className="text-sm text-muted-foreground">{order.currencyCode?.toUpperCase() ?? "ETB"}</p>
        </DetailCard>
        <DetailCard title="Customer">
          <DetailText label="Email" value={order.email} />
          <DetailText label="Name" value={order.delivery?.customerName} />
          <DetailText label="Phone" value={order.delivery?.customerPhone} />
        </DetailCard>
        <DetailCard title="Delivery">
          <DetailText label="Choice" value={order.delivery?.choice} />
          <DetailText label="Landmark" value={order.delivery?.landmark} />
          <DetailText label="Notes" value={order.delivery?.notes} />
        </DetailCard>
        <DetailCard title="Shipping address">
          <DetailText label="Name" value={[address?.firstName, address?.lastName].filter(Boolean).join(" ")} />
          <DetailText label="Phone" value={address?.phone} />
          <DetailText label="Address" value={[address?.address1, address?.address2, address?.city, address?.province, address?.countryCode].filter(Boolean).join(", ")} />
        </DetailCard>
        <DetailCard title="Fulfillments">
          <p className="text-sm text-muted-foreground">
            {(order.fulfillments?.length ?? 0).toLocaleString()} fulfillment records
          </p>
        </DetailCard>
      </aside>
    </div>
  );
}

function DetailCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-[1.35rem] border bg-card/95 p-5 shadow-sm shadow-primary/5">
      <h3 className="mb-4 font-heading text-base font-semibold">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function DetailText({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value?.trim() || "Not captured"}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the order detail route**

Create `apps/dashboard/src/app/admin/(dashboard)/orders/[orderId]/page.tsx`:

```tsx
import { headers } from "next/headers";

import { BreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrderDetail } from "@/features/orders/order-detail";
import { formatOrderDisplayId } from "@/features/orders/order-table-state";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
import { getMerchantOrder } from "@/lib/merchant-orders";

type MerchantOrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantOrderDetailPage({
  params,
  searchParams,
}: MerchantOrderDetailPageProps) {
  const [{ orderId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tenantId = getSelectedTenantId(resolvedSearchParams ?? {});
  const requestHeaders = await headers();
  const result = await getMerchantOrder({
    cookieHeader: requestHeaders.get("cookie"),
    orderId,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const errorState = result.ok ? null : getListErrorState("orders", result.message);
  const title = result.ok ? formatOrderDisplayId(result.order) : "Order details";

  return (
    <PageShell
      actions={<RefreshButton />}
      description="Review customer, delivery, payment, and fulfillment state for this merchant order."
      title={title}
    >
      <BreadcrumbLabel id="order-details" label={result.ok ? title : null} />
      {result.ok ? (
        <OrderDetail order={result.order} />
      ) : result.message === "order_not_found" ? (
        <Alert>
          <AlertTitle>Order was not found</AlertTitle>
          <AlertDescription>
            This order may belong to another merchant, may have been removed, or may no longer be
            available from the commerce backend.
          </AlertDescription>
        </Alert>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Order could not be loaded</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 3: Run dashboard tests, typecheck, and build**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/features/orders/order-detail.tsx apps/dashboard/src/app/admin/'(dashboard)'/orders/'[orderId]'/page.tsx
git commit -m "feat: add merchant order detail page"
```

---

### Task 5: Final Verification And Polish

**Files:**
- Modify only files from Tasks 1-4 if verification reveals issues.

- [ ] **Step 1: Run full dashboard verification**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
git diff --check
git status --short
```

Expected:

- Dashboard tests pass.
- Dashboard typecheck passes.
- Dashboard build passes.
- `git diff --check` reports no whitespace errors.
- `git status --short` is clean after any final commit.

- [ ] **Step 2: Manual QA checklist for the user**

Report these checks for manual browser QA:

- `/admin/orders` loads with upgraded table styling.
- Search filters current visible orders without page reload.
- Lifecycle filter works and shows the filtered empty state.
- Sort headers reorder visible rows.
- Row action menu opens and copy actions do not crash.
- Selecting rows shows floating selected bar and does not cover pagination.
- Detail links preserve selected tenant context.
- `/admin/orders/[orderId]` renders the detail page.
- Missing/not-found orders show clear copy.
- Light and dark themes keep table and detail surfaces readable.

- [ ] **Step 3: Commit any verification fixes**

If Step 1 or manual inspection uncovers code changes, commit them:

```bash
git add apps/dashboard/src
git commit -m "fix: polish merchant order management"
```

If there are no changes, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Orders list table controls, search, shadcn filter, sorting, row selection, row actions, refresh compatibility, pagination compatibility, and premium styling are covered by Task 3.
- Order detail fetcher, route, breadcrumb, and detail page are covered by Tasks 2 and 4.
- Existing error handling is reused in Task 4.
- Collections, categories, stock, variants, fulfillment mutations, refunds, and customer management remain out of scope as required.

Placeholder scan:

- No task uses placeholder implementation steps.
- Disabled mutation/action behavior is intentionally deferred because the spec excludes dashboard order mutations.

Type consistency:

- `OrderLifecycleFilter` values use underscore identifiers for code and shadcn `Select` values.
- Detail fetcher returns `MerchantOrderResult`.
- `dashboardRoutes.orderDetail(orderId)` is used consistently by list rows and detail routing.
