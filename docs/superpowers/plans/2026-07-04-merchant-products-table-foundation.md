# Merchant Products Table Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, reusable TanStack Table foundation and apply it to the merchant Products list before order management starts.

**Architecture:** Keep Platform API unchanged and upgrade the dashboard table locally. Split reusable table shell behavior from product-specific table state, cells, and row actions so Orders can reuse the shell later without copying product assumptions.

**Tech Stack:** Next.js App Router, React client components, shadcn table/dropdown/select/input/checkbox/button primitives, Remix icons through `AppIcons`, TanStack Table v8, Node test runner with `tsx`.

---

## File Structure

- Modify `apps/dashboard/src/components/app/data-table.tsx`: reusable table shell with TanStack sorting, filtering, pagination-independent row rendering, toolbar slots, selection support, floating selected-row bar, and premium table styling.
- Create `apps/dashboard/src/components/app/data-table-bulk-bar.tsx`: reusable floating selected rows surface.
- Create `apps/dashboard/src/components/app/data-table-header.tsx`: reusable sortable header button.
- Create `apps/dashboard/src/components/app/row-actions-menu.tsx`: reusable dropdown trigger/content for row actions.
- Create `apps/dashboard/src/features/products/product-table-state.ts`: pure product filtering, sorting-value, thumbnail, and count helpers.
- Create `apps/dashboard/src/features/products/product-table-state.test.ts`: Node tests for product table helper behavior.
- Create `apps/dashboard/src/features/products/product-table-cells.tsx`: product media cell, product identity cell, product status badge, and product table formatting helpers.
- Modify `apps/dashboard/src/features/products/products-table.tsx`: wire upgraded DataTable, product columns, search fields, status filter, row selection, row actions, and tenant-aware links.
- Modify `apps/dashboard/src/components/app/icons.ts`: add any missing Remix icons needed by table controls.
- Modify `apps/dashboard/src/app/admin/(dashboard)/products/page.tsx`: keep page-level fetch, total summary, and pagination, and pass total/page metadata into the table.

Do not modify Platform API in this plan. If implementation reveals a hard backend limitation, stop and write a separate backend query plan instead of expanding this slice.

---

### Task 1: Product Table State Helpers

**Files:**
- Create: `apps/dashboard/src/features/products/product-table-state.ts`
- Create: `apps/dashboard/src/features/products/product-table-state.test.ts`

- [ ] **Step 1: Write failing tests for product table search, filters, sort values, thumbnails, and counts**

Create `apps/dashboard/src/features/products/product-table-state.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantProduct } from "@ecs/contracts";

import {
  filterProductsForTable,
  getProductMediaCount,
  getProductPriceSortValue,
  getProductTableCounts,
  getProductThumbnail,
} from "./product-table-state.js";

const products: MerchantProduct[] = [
  {
    id: "prod_coffee",
    title: "Coffee beans",
    handle: "coffee-beans",
    description: null,
    status: "published",
    thumbnail: "https://cdn.example.com/coffee.jpg",
    collectionId: null,
    categoryIds: [],
    images: [{ id: "img_1", url: "https://cdn.example.com/coffee.jpg", rank: 0 }],
    variants: [
      {
        id: "var_1",
        title: "Default",
        sku: "COF-1",
        prices: [{ amount: 250, currencyCode: "etb" }],
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "prod_tea",
    title: "Black tea",
    handle: "black-tea",
    description: null,
    status: "draft",
    thumbnail: null,
    collectionId: null,
    categoryIds: [],
    images: [],
    variants: [],
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
  },
];

describe("product table state", () => {
  it("searches product title, handle, status, and id", () => {
    assert.deepEqual(
      filterProductsForTable(products, { query: "coffee", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_coffee"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "draft", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "prod_tea", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
  });

  it("filters products by normalized status", () => {
    assert.deepEqual(
      filterProductsForTable(products, { query: "", status: "published" }).map(
        (product) => product.id,
      ),
      ["prod_coffee"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "", status: "draft" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
  });

  it("derives price, media, thumbnail, and filtered counts", () => {
    assert.equal(getProductPriceSortValue(products[0]), 250);
    assert.equal(getProductPriceSortValue(products[1]), null);
    assert.equal(getProductMediaCount(products[0]), 1);
    assert.equal(getProductMediaCount(products[1]), 0);
    assert.deepEqual(getProductThumbnail(products[0]), {
      kind: "image",
      url: "https://cdn.example.com/coffee.jpg",
    });
    assert.deepEqual(getProductThumbnail(products[1]), {
      initials: "BT",
      kind: "fallback",
    });
    assert.deepEqual(getProductTableCounts({ filteredCount: 1, pageCount: 2, totalCount: 9 }), {
      filteredCount: 1,
      hasActiveFilter: true,
      pageCount: 2,
      totalCount: 9,
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because the helper module does not exist**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: FAIL with a module resolution error for `product-table-state.js`.

- [ ] **Step 3: Implement the pure helper module**

Create `apps/dashboard/src/features/products/product-table-state.ts`:

```ts
import type { MerchantProduct } from "@ecs/contracts";

export type ProductStatusFilter = "all" | "published" | "draft" | "unknown";

export type ProductTableFilterInput = {
  query: string;
  status: ProductStatusFilter;
};

export type ProductThumbnail =
  | {
      kind: "image";
      url: string;
    }
  | {
      initials: string;
      kind: "fallback";
    };

export function filterProductsForTable(
  products: MerchantProduct[],
  input: ProductTableFilterInput,
) {
  const query = input.query.trim().toLowerCase();

  return products.filter((product) => {
    const status = normalizeProductStatus(product.status);
    const matchesStatus = input.status === "all" || status === input.status;
    const matchesQuery = !query || getProductSearchText(product).includes(query);

    return matchesStatus && matchesQuery;
  });
}

export function getProductSearchText(product: MerchantProduct) {
  return [
    product.id,
    product.title,
    product.handle,
    product.status,
    product.description,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function normalizeProductStatus(status: string | null): ProductStatusFilter {
  const normalized = status?.toLowerCase();

  if (normalized === "published" || normalized === "draft") {
    return normalized;
  }

  return "unknown";
}

export function getProductPriceSortValue(product: MerchantProduct) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number");

  return typeof price?.amount === "number" ? price.amount : null;
}

export function getProductMediaCount(product: MerchantProduct) {
  const imageCount = product.images?.length ?? 0;

  return product.thumbnail ? Math.max(1, imageCount) : imageCount;
}

export function getProductThumbnail(product: MerchantProduct): ProductThumbnail {
  if (product.thumbnail) {
    return {
      kind: "image",
      url: product.thumbnail,
    };
  }

  const label = product.title ?? product.handle ?? product.id;
  const initials = label
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return {
    initials: initials || "PR",
    kind: "fallback",
  };
}

export function getProductTableCounts(input: {
  filteredCount: number;
  pageCount: number;
  totalCount: number;
}) {
  return {
    ...input,
    hasActiveFilter: input.filteredCount !== input.pageCount,
  };
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS, including the new product table state tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/products/product-table-state.ts apps/dashboard/src/features/products/product-table-state.test.ts
git commit -m "test: add product table state helpers"
```

---

### Task 2: Reusable Table Shell Components

**Files:**
- Modify: `apps/dashboard/src/components/app/data-table.tsx`
- Create: `apps/dashboard/src/components/app/data-table-bulk-bar.tsx`
- Create: `apps/dashboard/src/components/app/data-table-header.tsx`
- Modify: `apps/dashboard/src/components/app/icons.ts`

- [ ] **Step 1: Add missing shared icons**

Modify `apps/dashboard/src/components/app/icons.ts` to import and expose the table icons:

```ts
import {
  RiArrowDownSLine,
  RiArrowUpDownLine,
  RiArrowUpSLine,
  RiBankCardLine,
  RiBarChartBoxLine,
  RiCloseLine,
  RiCommandLine,
  RiFileCopyLine,
  RiImageLine,
  RiMore2Line,
  RiEyeCloseLine,
  RiEyeLine,
  RiHome5Line,
  RiLockLine,
  RiLockUnlockLine,
  RiLogoutBoxRLine,
  RiMoonLine,
  RiPaintBrushLine,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
  RiShoppingBag3Line,
  RiShoppingCart2Line,
  RiSunLine,
  RiUser3Line,
} from "@remixicon/react";
```

Add these keys to `AppIcons`:

```ts
arrowDown: RiArrowDownSLine,
arrowUp: RiArrowUpSLine,
arrowUpDown: RiArrowUpDownLine,
close: RiCloseLine,
copy: RiFileCopyLine,
image: RiImageLine,
more: RiMore2Line,
```

- [ ] **Step 2: Create the sortable header component**

Create `apps/dashboard/src/components/app/data-table-header.tsx`:

```tsx
"use client";

import type { Column } from "@tanstack/react-table";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableHeaderProps<TData, TValue> = {
  className?: string;
  column: Column<TData, TValue>;
  title: string;
};

export function DataTableHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn("text-xs font-medium text-muted-foreground", className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();
  const SortIcon =
    sorted === "asc" ? AppIcons.arrowUp : sorted === "desc" ? AppIcons.arrowDown : AppIcons.arrowUpDown;

  return (
    <Button
      aria-label={`Sort by ${title}`}
      className={cn("-ml-2 h-8 rounded-full px-2 text-xs font-medium text-muted-foreground", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
      type="button"
      variant="ghost"
    >
      {title}
      <SortIcon data-icon="inline-end" />
    </Button>
  );
}
```

- [ ] **Step 3: Create the floating bulk selection bar**

Create `apps/dashboard/src/components/app/data-table-bulk-bar.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableBulkBarProps = {
  actions?: ReactNode;
  className?: string;
  onClearSelection: () => void;
  selectedCount: number;
};

export function DataTableBulkBar({
  actions,
  className,
  onClearSelection,
  selectedCount,
}: DataTableBulkBarProps) {
  if (selectedCount < 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 mx-auto mt-4 flex w-fit max-w-full items-center gap-3 rounded-full border bg-popover/95 px-3 py-2 text-sm text-popover-foreground shadow-xl shadow-primary/10 ring-1 ring-foreground/10 backdrop-blur transition-all duration-200",
        className,
      )}
    >
      <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
        {selectedCount} selected
      </span>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      <Button aria-label="Clear selection" onClick={onClearSelection} size="icon-sm" type="button" variant="ghost">
        <AppIcons.close data-icon="inline-start" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Replace the simple DataTable shell with the upgraded shell**

Modify `apps/dashboard/src/components/app/data-table.tsx` so its public API is:

```ts
type DataTableProps<TData> = {
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyMessage: string;
  filteredEmptyMessage?: string;
  getRowId?: (row: TData) => string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  selectedSummaryLabel?: string;
  toolbar?: React.ReactNode;
};
```

The implementation must:

- use `useReactTable` with `getCoreRowModel`, `getFilteredRowModel`, and `getSortedRowModel`;
- own `sorting` and `rowSelection` state;
- pass `globalFilter` into TanStack state;
- render `toolbar` above the table inside the rounded container;
- render `DataTableBulkBar` when rows are selected;
- style rows with `data-state={row.getIsSelected() ? "selected" : undefined}`;
- use `filteredEmptyMessage` when data exists but filtered row model is empty;
- keep native shadcn table primitives.

Use this concrete styling baseline for the outer structure, then render the existing header and body loops inside the marked locations:

```tsx
<div className="overflow-hidden rounded-[1.35rem] border bg-card/95 shadow-sm shadow-primary/5">
  {toolbar ? <div className="border-b bg-muted/20 p-3">{toolbar}</div> : null}
  <div className="overflow-x-auto">
    <Table>
      <TableHeader className="bg-muted/30">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow className="hover:bg-transparent" key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead className="h-11 px-4 text-xs uppercase text-muted-foreground" key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            data-state={row.getIsSelected() ? "selected" : undefined}
            key={row.id}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell className="px-4 py-3" key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
  <DataTableBulkBar
    actions={bulkActions?.(table.getFilteredSelectedRowModel().rows.map((row) => row.original))}
    onClearSelection={() => table.resetRowSelection()}
    selectedCount={table.getFilteredSelectedRowModel().rows.length}
  />
</div>
```

- [ ] **Step 5: Run dashboard typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS. If existing product/order table callers fail because the `DataTable` API changed, keep backward-compatible defaults for all new props.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/app/data-table.tsx apps/dashboard/src/components/app/data-table-bulk-bar.tsx apps/dashboard/src/components/app/data-table-header.tsx apps/dashboard/src/components/app/icons.ts
git commit -m "feat: upgrade dashboard data table shell"
```

---

### Task 3: Reusable Row Actions Menu

**Files:**
- Create: `apps/dashboard/src/components/app/row-actions-menu.tsx`

- [ ] **Step 1: Create a reusable row actions menu**

Create `apps/dashboard/src/components/app/row-actions-menu.tsx`:

```tsx
"use client";

import Link from "next/link";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction =
  | {
      disabled?: boolean;
      href: string;
      label: string;
      type: "link";
    }
  | {
      disabled?: boolean;
      label: string;
      onSelect: () => void;
      type: "button";
    }
  | {
      type: "separator";
    };

type RowActionsMenuProps = {
  actions: RowAction[];
  label: string;
};

export function RowActionsMenu({ actions, label }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} className="rounded-full" size="icon-sm" type="button" variant="ghost">
          <AppIcons.more data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5" sideOffset={8}>
        <DropdownMenuGroup>
          {actions.map((action, index) => {
            if (action.type === "separator") {
              return <DropdownMenuSeparator key={`separator-${index}`} />;
            }

            if (action.type === "link") {
              return (
                <DropdownMenuItem asChild className="rounded-xl px-2 py-2" disabled={action.disabled} key={action.label}>
                  <Link href={action.href}>{action.label}</Link>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                className="rounded-xl px-2 py-2"
                disabled={action.disabled}
                key={action.label}
                onSelect={action.onSelect}
              >
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Run dashboard typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/app/row-actions-menu.tsx
git commit -m "feat: add reusable row actions menu"
```

---

### Task 4: Product Table Cells

**Files:**
- Create: `apps/dashboard/src/features/products/product-table-cells.tsx`
- Modify: `apps/dashboard/src/features/products/products-table.tsx`

- [ ] **Step 1: Create product table cell components**

Create `apps/dashboard/src/features/products/product-table-cells.tsx`:

```tsx
"use client";

import type { MerchantProduct } from "@ecs/contracts";
import Link from "next/link";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { getProductMediaCount, getProductThumbnail, normalizeProductStatus } from "@/features/products/product-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

export function ProductIdentityCell({
  product,
  tenantId,
}: {
  product: MerchantProduct;
  tenantId?: string | undefined;
}) {
  const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);

  return (
    <div className="flex min-w-72 items-center gap-3">
      <ProductMediaCell product={product} />
      <div className="flex min-w-0 flex-col gap-1">
        <Link className="truncate font-medium text-foreground transition-colors hover:text-primary" href={href}>
          {product.title ?? "Untitled product"}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {product.handle ? `/${product.handle}` : product.id}
        </span>
      </div>
    </div>
  );
}

export function ProductMediaCell({ product }: { product: MerchantProduct }) {
  const thumbnail = getProductThumbnail(product);

  if (thumbnail.kind === "image") {
    return (
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted/40">
        <img alt="" className="size-full object-cover" src={thumbnail.url} />
      </div>
    );
  }

  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-2xl border bg-primary/10 text-xs font-semibold text-primary">
      {thumbnail.initials || <AppIcons.image data-icon="inline-start" />}
    </div>
  );
}

export function ProductStatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeProductStatus(status);
  const variant = normalized === "published" ? "default" : normalized === "draft" ? "secondary" : "outline";

  return (
    <Badge className="rounded-full px-2.5 capitalize" variant={variant}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

export function ProductMediaSignal({ product }: { product: MerchantProduct }) {
  const count = getProductMediaCount(product);

  return <span className="text-muted-foreground">{count ? `${count} asset${count === 1 ? "" : "s"}` : "No media"}</span>;
}

export function formatProductDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatProductFirstPrice(product: MerchantProduct) {
  const price = product.variants
    ?.flatMap((variant) => variant.prices)
    .find((variantPrice) => typeof variantPrice.amount === "number" && variantPrice.currencyCode);

  if (!price || typeof price.amount !== "number" || !price.currencyCode) {
    return "No price";
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}
```

- [ ] **Step 2: Remove duplicated product formatting from `products-table.tsx`**

Modify `apps/dashboard/src/features/products/products-table.tsx` imports to use the new cell helpers:

```ts
import {
  formatProductDate,
  formatProductFirstPrice,
  ProductIdentityCell,
  ProductMediaSignal,
  ProductStatusBadge,
} from "@/features/products/product-table-cells";
```

Remove local `ProductStatusBadge`, `formatDate`, `formatFirstPrice`, and `formatMediaSignal` from `products-table.tsx`.

- [ ] **Step 3: Run dashboard typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/features/products/product-table-cells.tsx apps/dashboard/src/features/products/products-table.tsx
git commit -m "feat: add product table cells"
```

---

### Task 5: Product Table Controls, Selection, And Row Actions

**Files:**
- Modify: `apps/dashboard/src/features/products/products-table.tsx`

- [ ] **Step 1: Upgrade product columns**

Modify `apps/dashboard/src/features/products/products-table.tsx` so `getProductColumns(tenantId)` returns columns for:

- selection checkbox column,
- product identity with thumbnail and link,
- status with `ProductStatusBadge`,
- price with sorting value from `getProductPriceSortValue`,
- variants,
- media with sorting value from `getProductMediaCount`,
- updated date,
- row actions.

Use TanStack display columns for selection and actions:

```tsx
{
  id: "select",
  header: ({ table }) => (
    <Checkbox
      aria-label="Select all visible products"
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      aria-label={`Select ${row.original.title ?? row.original.id}`}
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
    />
  ),
  enableHiding: false,
  enableSorting: false,
}
```

Use `DataTableHeader` in sortable headers:

```tsx
header: ({ column }) => <DataTableHeader column={column} title="Product" />
```

Use row actions:

```tsx
cell: ({ row }) => {
  const product = row.original;
  const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);

  return (
    <RowActionsMenu
      actions={[
        { href, label: "View details", type: "link" },
        { href, label: "Edit product", type: "link" },
        { type: "separator" },
        {
          label: "Copy product ID",
          onSelect: () => void navigator.clipboard?.writeText(product.id),
          type: "button",
        },
        {
          disabled: !product.handle,
          label: "Copy handle",
          onSelect: () => void navigator.clipboard?.writeText(product.handle ?? ""),
          type: "button",
        },
      ]}
      label={`Open actions for ${product.title ?? product.id}`}
    />
  );
}
```

- [ ] **Step 2: Add product table toolbar state**

Inside `ProductsTable`, add `useMemo`/`useState` for:

```ts
const [query, setQuery] = useState("");
const [status, setStatus] = useState<ProductStatusFilter>("all");
const filteredProducts = useMemo(
  () => filterProductsForTable(products, { query, status }),
  [products, query, status],
);
const counts = getProductTableCounts({
  filteredCount: filteredProducts.length,
  pageCount: products.length,
  totalCount,
});
```

Update `ProductsTableProps`:

```ts
type ProductsTableProps = {
  pageSize: number;
  products: MerchantProduct[];
  tenantId?: string | undefined;
  totalCount: number;
};
```

Render toolbar with shadcn input group and select:

```tsx
const toolbar = (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
        <InputGroupAddon>
          <AppIcons.search data-icon="inline-start" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search products"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          value={query}
        />
      </InputGroup>
      <Select onValueChange={(value) => setStatus(value as ProductStatusFilter)} value={status}>
        <SelectTrigger aria-label="Filter products by status" className="h-10 rounded-full sm:w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
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
);
```

- [ ] **Step 3: Wire upgraded DataTable props**

Render:

```tsx
<DataTable
  bulkActions={(selectedProducts) => (
    <Button
      onClick={() => void navigator.clipboard?.writeText(selectedProducts.map((product) => product.id).join("\n"))}
      size="sm"
      type="button"
      variant="outline"
    >
      <AppIcons.copy data-icon="inline-start" />
      Copy IDs
    </Button>
  )}
  columns={getProductColumns(tenantId)}
  data={filteredProducts}
  emptyMessage="No products have been synced for this merchant yet."
  filteredEmptyMessage="No products match the current search or filters."
  getRowId={(product) => product.id}
  toolbar={toolbar}
/>
```

- [ ] **Step 4: Run dashboard test and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/products/products-table.tsx
git commit -m "feat: add product table controls"
```

---

### Task 6: Product Page Integration

**Files:**
- Modify: `apps/dashboard/src/app/admin/(dashboard)/products/page.tsx`

- [ ] **Step 1: Pass total count and page size to `ProductsTable`**

Modify the product page table call:

```tsx
<ProductsTable
  pageSize={result.products.limit}
  products={result.products.products}
  tenantId={tenantId}
  totalCount={result.products.count}
/>
```

- [ ] **Step 2: Keep page-level `ListSummary` as total catalog context**

Keep the existing page-level total summary above the table:

```tsx
<ListSummary count={result.products.count} label="products" />
```

The table toolbar should only describe the current server page and active filters. Do not remove pagination controls.

- [ ] **Step 3: Run dashboard test and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/app/admin/'(dashboard)'/products/page.tsx
git commit -m "feat: integrate product table foundation"
```

---

### Task 7: Visual Polish Pass

**Files:**
- Modify: `apps/dashboard/src/components/app/data-table.tsx`
- Modify: `apps/dashboard/src/features/products/product-table-cells.tsx`
- Modify: `apps/dashboard/src/features/products/products-table.tsx`
- Modify: `apps/dashboard/src/app/globals.css` only if a reusable table token is needed.

- [ ] **Step 1: Polish table density and responsive behavior**

Check these concrete requirements in code:

- table outer container uses `rounded-[1.35rem]` or equivalent premium radius;
- header is muted and low-contrast;
- row hover uses semantic tokens and a transition;
- selected rows have a visible but restrained state;
- thumbnail fallback is visually centered in light and dark themes;
- row actions menu has rounded content and enough side offset;
- floating selected bar does not cover pagination on desktop.

- [ ] **Step 2: Run dashboard build**

Run:

```bash
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 3: Manual visual QA**

Ask the user to check `http://abebe.lvh.me/admin/products` after restarting or allowing the dev server to hot reload.

Manual QA checklist:

- Search filters visible rows without page reload.
- Status filter works.
- Sortable headers show direction and reorder rows.
- Thumbnail and fallback look intentional.
- Row action menu opens with view/edit/copy actions.
- Selection checkboxes show selected state.
- Floating selected bar appears and clears correctly.
- Pagination still works.
- Light and dark themes both look acceptable.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/app/data-table.tsx apps/dashboard/src/features/products/product-table-cells.tsx apps/dashboard/src/features/products/products-table.tsx apps/dashboard/src/app/globals.css
git commit -m "style: polish product data table"
```

Only include `globals.css` if it changed.

---

### Task 8: Final Verification

**Files:**
- No required file edits.

- [ ] **Step 1: Run dashboard tests**

```bash
pnpm --filter @ecs/dashboard test
```

Expected: PASS.

- [ ] **Step 2: Run dashboard typecheck**

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dashboard build**

```bash
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 4: Run diff check**

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Inspect final diff**

```bash
git status --short
git diff --stat
```

Expected: only dashboard table/product files from this plan are changed unless committed in prior tasks.

- [ ] **Step 6: Final commit if needed**

If any verification-only cleanup remains:

```bash
git add apps/dashboard
git commit -m "fix: finalize product table foundation"
```

If the working tree is clean, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Search, sort, filter, row actions, row selection, selected bulk bar, thumbnails, fallback media, entity links, current-page summary, and reusable Orders foundation are all assigned to tasks.
- Category, collection, variant, stock, order management, and destructive bulk actions remain out of scope as required.
- Platform API is intentionally unchanged.

Placeholder scan:

- No task uses placeholder wording.
- Code snippets define concrete imports, props, and behavior.

Type consistency:

- `ProductsTableProps` receives `products`, `tenantId`, `totalCount`, and `pageSize`.
- `DataTable` owns TanStack selection and sorting; product-specific filtering happens before data is passed in.
- Product state helpers import `MerchantProduct` from `@ecs/contracts`, matching current product table code.
