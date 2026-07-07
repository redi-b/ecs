# Product Variant Stock Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build variant-aware product creation, inventory management, product detail editing, practical catalog/order filters, and taxonomy creation modals.

**Architecture:** Medusa remains the source of truth for products, variants, prices, inventory items, and stock levels. The platform API exposes tenant-scoped contracts that are explicit about variants and stock locations, and the dashboard consumes those contracts through focused feature modules instead of product-level stock assumptions.

**Tech Stack:** TypeScript, pnpm workspaces, Hono platform API, Zod contracts, Next.js dashboard, TanStack Form, TanStack Query, existing app UI components.

---

## Existing Files And Responsibilities

- `packages/contracts/src/index.ts`: shared API schemas and inferred TypeScript types.
- `apps/platform-api/src/routes/merchant-routes.ts`: tenant-scoped merchant HTTP routes.
- `apps/platform-api/src/commerce/product-service.ts`: Medusa product, variant, price, category, collection, and inventory integration.
- `apps/platform-api/src/commerce/product-service.test.ts`: service-level coverage for Medusa product and stock behavior.
- `apps/platform-api/src/app.test.ts`: route-level coverage for platform merchant endpoints.
- `apps/dashboard/src/lib/merchant-products.ts`: dashboard client helpers for merchant product API calls.
- `apps/dashboard/src/lib/product-form-data.ts`: form-data to product payload parser for server actions.
- `apps/dashboard/src/features/products/product-form.tsx`: current create/edit composer.
- `apps/dashboard/src/features/products/product-form-fields.tsx`: reusable product form field components.
- `apps/dashboard/src/features/products/product-create-dialog.tsx`: product create dialog shell.
- `apps/dashboard/src/features/products/product-edit-dialog.tsx`: current edit dialog wrapper around the create composer.
- `apps/dashboard/src/features/products/product-detail.tsx`: product detail page sections and variants table.
- `apps/dashboard/src/features/products/product-stock-panel.tsx`: current stock panel with product-level stock action.
- `apps/dashboard/src/features/products/product-table-state.ts`: product table search/filter/sort helpers.
- `apps/dashboard/src/features/products/products-table.tsx`: product table UI and filter controls.
- `apps/dashboard/src/features/orders/order-table-state.ts`: order table search/filter/sort helpers.
- `apps/dashboard/src/features/orders/orders-table.tsx`: order table UI and filter controls.
- `apps/dashboard/src/features/catalog-taxonomy/product-categories-table.tsx`: category table and actions.
- `apps/dashboard/src/features/catalog-taxonomy/product-collections-table.tsx`: collection table and actions.
- `apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx`: category/collection form UI.
- `apps/dashboard/src/lib/taxonomy-form-data.ts`: taxonomy form-data parsing.

## Verification Commands

Run focused commands after each phase:

```bash
pnpm --filter @ecs/contracts typecheck
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Run broad verification before the final handoff:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Phase 1: Variant-Aware Backend Contract And Stock API

### Task 1: Extend Shared Product Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Add variant creation and stock schemas**

Add schemas near the existing merchant product schemas:

```ts
export const merchantProductVariantWriteSchema = z.object({
  optionValues: z.record(z.string().min(1), z.string().min(1)),
  sku: z.string().min(1).nullable().optional(),
  priceAmount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  stockedQuantity: z.number().int().nonnegative().optional(),
});

export const merchantProductWriteSchema = z.object({
  categoryIds: z.array(z.string().min(1)).optional(),
  collectionId: z.string().min(1).nullable().optional(),
  currencyCode: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  handle: z.string().min(1).nullable().optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  options: z
    .array(
      z.object({
        title: z.string().min(1),
        values: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
  priceAmount: z.number().nonnegative().optional(),
  status: z.string().min(1).nullable().optional(),
  thumbnail: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
  variants: z.array(merchantProductVariantWriteSchema).optional(),
});

export type MerchantProductVariantWrite = z.infer<typeof merchantProductVariantWriteSchema>;
export type MerchantProductWrite = z.infer<typeof merchantProductWriteSchema>;
```

- [ ] **Step 2: Extend product variant response stock summary**

Add `stock` to each response variant object:

```ts
stock: merchantProductStockSchema.omit({ productId: true, variantId: true, inventoryItemId: true }).nullable().optional(),
```

Keep `inventoryItemId` nullable because Medusa may return non-stock-managed variants.

- [ ] **Step 3: Verify contract typecheck**

Run:

```bash
pnpm --filter @ecs/contracts typecheck
```

Expected: command exits successfully.

- [ ] **Step 4: Commit contracts**

```bash
git add packages/contracts/src/index.ts
git commit -m "feat: add variant product contracts"
```

### Task 2: Add Route Tests For Variant Stock

**Files:**
- Modify: `apps/platform-api/src/app.test.ts`

- [ ] **Step 1: Add route test for reading variant stock**

Add a test that calls the new route shape and asserts the route forwards `productId`, `variantId`, and tenant stock location:

```ts
test("gets stock for a specific product variant", async () => {
  const app = createTestApp({
    commerceContext: {
      ok: true,
      context: {
        tenantId: "tenant_1",
        medusaSalesChannelId: "sc_1",
        medusaStockLocationId: "sloc_1",
      },
    },
    getMerchantProductVariantStock: async (input) => ({
      ok: true,
      stock: {
        productId: input.productId,
        variantId: input.variantId,
        inventoryItemId: "iitem_1",
        locationId: input.stockLocationId,
        stockedQuantity: 12,
        reservedQuantity: 2,
        incomingQuantity: 0,
        availableQuantity: 10,
      },
    }),
  });

  const response = await app.request(
    "/platform/merchant/products/prod_1/variants/variant_1/stock",
    { headers: merchantHeaders },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    stock: {
      productId: "prod_1",
      variantId: "variant_1",
      inventoryItemId: "iitem_1",
      locationId: "sloc_1",
      stockedQuantity: 12,
      reservedQuantity: 2,
      incomingQuantity: 0,
      availableQuantity: 10,
    },
  });
});
```

- [ ] **Step 2: Add route test for updating variant stock**

```ts
test("updates stock for a specific product variant", async () => {
  const app = createTestApp({
    commerceContext: {
      ok: true,
      context: {
        tenantId: "tenant_1",
        medusaSalesChannelId: "sc_1",
        medusaStockLocationId: "sloc_1",
      },
    },
    updateMerchantProductVariantStock: async (input) => ({
      ok: true,
      stock: {
        productId: input.productId,
        variantId: input.variantId,
        inventoryItemId: "iitem_1",
        locationId: input.stockLocationId,
        stockedQuantity: input.stockedQuantity,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: input.stockedQuantity,
      },
    }),
  });

  const response = await app.request(
    "/platform/merchant/products/prod_1/variants/variant_1/stock",
    {
      method: "POST",
      headers: { ...merchantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ stockedQuantity: 24 }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).stock.stockedQuantity, 24);
});
```

- [ ] **Step 3: Run route tests to verify failure**

Run:

```bash
pnpm --filter @ecs/platform-api test -- src/app.test.ts
```

Expected: fails because `getMerchantProductVariantStock`, `updateMerchantProductVariantStock`, and routes do not exist yet.

### Task 3: Implement Variant Stock Routes

**Files:**
- Modify: `apps/platform-api/src/routes/merchant-routes.ts`
- Modify: `apps/platform-api/src/app.ts`
- Modify: `apps/platform-api/src/index.ts`

- [ ] **Step 1: Extend app option types**

Add service callbacks to the platform app options:

```ts
getMerchantProductVariantStock: (input: {
  productId: string;
  variantId: string;
  salesChannelId: string;
  stockLocationId: string;
}) => Promise<MerchantProductStockResult>;
updateMerchantProductVariantStock: (input: {
  productId: string;
  variantId: string;
  salesChannelId: string;
  stockLocationId: string;
  stockedQuantity: number;
}) => Promise<MerchantProductStockResult>;
```

- [ ] **Step 2: Register services in production app wiring**

In `apps/platform-api/src/index.ts`, pass:

```ts
getMerchantProductVariantStock: productService.getMerchantProductVariantStock,
updateMerchantProductVariantStock: productService.updateMerchantProductVariantStock,
```

- [ ] **Step 3: Add GET variant stock route**

Add after the existing product stock route:

```ts
app.get("/platform/merchant/products/:productId/variants/:variantId/stock", async (context) => {
  const commerce = await resolveMerchantCommerceContext(context);
  if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

  const stockLocationId = commerce.context.medusaStockLocationId;
  if (!stockLocationId) {
    return context.json({ error: "inventory_location_unavailable" }, 503);
  }

  const stock = await options.getMerchantProductVariantStock({
    productId: context.req.param("productId"),
    variantId: context.req.param("variantId"),
    salesChannelId: commerce.context.medusaSalesChannelId,
    stockLocationId,
  });

  if (!stock.ok) {
    return context.json({ error: stock.error }, stock.status);
  }

  return context.json({ stock: stock.stock });
});
```

- [ ] **Step 4: Add POST variant stock route**

```ts
app.post("/platform/merchant/products/:productId/variants/:variantId/stock", async (context) => {
  const commerce = await resolveMerchantCommerceContext(context);
  if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

  const body = await context.req.json().catch(() => ({}));
  const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

  if (stockedQuantity === undefined || stockedQuantity < 0 || !Number.isInteger(stockedQuantity)) {
    return context.json({ error: "invalid_stocked_quantity" }, 400);
  }

  const stockLocationId = commerce.context.medusaStockLocationId;
  if (!stockLocationId) {
    return context.json({ error: "inventory_location_unavailable" }, 503);
  }

  const stock = await options.updateMerchantProductVariantStock({
    productId: context.req.param("productId"),
    variantId: context.req.param("variantId"),
    salesChannelId: commerce.context.medusaSalesChannelId,
    stockLocationId,
    stockedQuantity,
  });

  if (!stock.ok) {
    return context.json({ error: stock.error }, stock.status);
  }

  return context.json({ stock: stock.stock });
});
```

- [ ] **Step 5: Run route tests**

Run:

```bash
pnpm --filter @ecs/platform-api test -- src/app.test.ts
```

Expected: variant stock route tests pass; service tests may still fail until Task 4.

### Task 4: Implement Product Service Variant Stock Methods

**Files:**
- Modify: `apps/platform-api/src/commerce/product-service.ts`
- Modify: `apps/platform-api/src/commerce/product-service.test.ts`

- [ ] **Step 1: Add service tests for positive multi-variant stock**

Replace the current multi-variant rejection tests with tests named:

```ts
test("gets stock for a specific multi-variant product variant", async () => {
  // Arrange Medusa product response with variants variant_1 and variant_2.
  // Arrange inventory item iitem_1 on variant_1.
  // Act with productId prod_1, variantId variant_1, salesChannelId sc_1, stockLocationId sloc_1.
  // Assert returned stock.variantId === "variant_1" and stock.inventoryItemId === "iitem_1".
});

test("updates stock for a specific multi-variant product variant", async () => {
  // Arrange Medusa product response with variant_1 inventory item iitem_1.
  // Arrange successful inventory level update response.
  // Assert update payload uses stocked_quantity from input and location sloc_1.
});
```

Use the same mock Medusa fetch helpers and response shapes already used by the existing single-variant stock tests.

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
pnpm --filter @ecs/platform-api test -- src/commerce/product-service.test.ts
```

Expected: fails because the new service methods do not exist.

- [ ] **Step 3: Add helper for resolving a specific variant inventory item**

Add a helper near the existing stock resolution helpers:

```ts
function resolveVariantInventory(input: {
  product: MedusaProduct;
  variantId: string;
}): { variantId: string; inventoryItemId: string } | null {
  const variant = input.product.variants?.find((item) => getString(item.id) === input.variantId);
  if (!variant) return null;

  const inventoryItemId = getVariantInventoryItemId(variant);
  if (!inventoryItemId) return null;

  return {
    variantId: input.variantId,
    inventoryItemId,
  };
}
```

- [ ] **Step 4: Add service methods**

Implement by reusing the existing product ownership, inventory level, and update helpers:

```ts
getMerchantProductVariantStock: async (input) => {
  const product = await getMerchantProductForSalesChannel({
    productId: input.productId,
    salesChannelId: input.salesChannelId,
  });
  if (!product.ok) return product;

  const inventory = resolveVariantInventory({
    product: product.product,
    variantId: input.variantId,
  });
  if (!inventory) return { ok: false, error: "variant_inventory_unavailable", status: 404 };

  return getInventoryItemStock(fetcher, options, {
    productId: input.productId,
    variantId: inventory.variantId,
    inventoryItemId: inventory.inventoryItemId,
    stockLocationId: input.stockLocationId,
  });
},
updateMerchantProductVariantStock: async (input) => {
  const product = await getMerchantProductForSalesChannel({
    productId: input.productId,
    salesChannelId: input.salesChannelId,
  });
  if (!product.ok) return product;

  const inventory = resolveVariantInventory({
    product: product.product,
    variantId: input.variantId,
  });
  if (!inventory) return { ok: false, error: "variant_inventory_unavailable", status: 404 };

  const response = await requestMedusa(
    fetcher,
    getInventoryItemLevelUrl(options.medusaInternalUrl, {
      inventoryItemId: inventory.inventoryItemId,
      stockLocationId: input.stockLocationId,
    }),
    {
      method: "POST",
      body: JSON.stringify({ stocked_quantity: input.stockedQuantity }),
    },
  );

  if (!response.ok) {
    return mapMedusaError(response, "stock_update_failed");
  }

  return {
    ok: true,
    stock: {
      productId: input.productId,
      variantId: inventory.variantId,
      inventoryItemId: inventory.inventoryItemId,
      locationId: input.stockLocationId,
      stockedQuantity: input.stockedQuantity,
      reservedQuantity: null,
      incomingQuantity: null,
      availableQuantity: input.stockedQuantity,
    },
  };
},
```

This mirrors the existing `updateMerchantProductStock` method and differs only in how the inventory item is resolved.

- [ ] **Step 5: Run platform API tests and typecheck**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit backend stock foundation**

```bash
git add packages/contracts/src/index.ts apps/platform-api/src/app.ts apps/platform-api/src/index.ts apps/platform-api/src/routes/merchant-routes.ts apps/platform-api/src/commerce/product-service.ts apps/platform-api/src/commerce/product-service.test.ts apps/platform-api/src/app.test.ts
git commit -m "feat: add variant stock management api"
```

## Phase 2: Variant Matrix Product Creation

### Task 5: Add Pure Variant Matrix Helpers

**Files:**
- Create: `apps/dashboard/src/features/products/product-variant-matrix.ts`
- Create: `apps/dashboard/src/features/products/product-variant-matrix.test.ts`

- [ ] **Step 1: Write matrix helper tests**

Create tests for cartesian generation and override preservation:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildVariantMatrix, getVariantMatrixKey } from "./product-variant-matrix";

test("builds variants from multiple option groups", () => {
  const rows = buildVariantMatrix({
    options: [
      { title: "Size", values: ["S", "M"] },
      { title: "Color", values: ["Black", "White"] },
    ],
    defaults: { currencyCode: "usd", priceAmount: 25, stockedQuantity: 5, skuPrefix: "TEE" },
    overrides: new Map(),
  });

  assert.deepEqual(
    rows.map((row) => row.optionValues),
    [
      { Size: "S", Color: "Black" },
      { Size: "S", Color: "White" },
      { Size: "M", Color: "Black" },
      { Size: "M", Color: "White" },
    ],
  );
  assert.equal(rows[0]?.priceAmount, 25);
  assert.equal(rows[0]?.stockedQuantity, 5);
  assert.equal(rows[0]?.sku, "TEE-S-BLACK");
});

test("preserves row overrides by stable option key", () => {
  const key = getVariantMatrixKey({ Size: "M", Color: "Black" });
  const rows = buildVariantMatrix({
    options: [
      { title: "Size", values: ["S", "M"] },
      { title: "Color", values: ["Black"] },
    ],
    defaults: { currencyCode: "usd", priceAmount: 25, stockedQuantity: 5, skuPrefix: "TEE" },
    overrides: new Map([[key, { priceAmount: 31, stockedQuantity: 9, sku: "CUSTOM" }]]),
  });

  const overridden = rows.find((row) => row.key === key);
  assert.equal(overridden?.priceAmount, 31);
  assert.equal(overridden?.stockedQuantity, 9);
  assert.equal(overridden?.sku, "CUSTOM");
});
```

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/features/products/product-variant-matrix.test.ts
```

Expected: fails because the helper file does not exist.

- [ ] **Step 3: Implement matrix helpers**

```ts
export type ProductOptionDraft = {
  title: string;
  values: string[];
};

export type VariantDefaults = {
  currencyCode: string;
  priceAmount: number;
  stockedQuantity: number;
  skuPrefix: string;
};

export type VariantOverride = {
  sku?: string;
  priceAmount?: number;
  stockedQuantity?: number;
};

export type VariantMatrixRow = {
  key: string;
  optionValues: Record<string, string>;
  sku: string;
  priceAmount: number;
  currencyCode: string;
  stockedQuantity: number;
};

export function getVariantMatrixKey(optionValues: Record<string, string>) {
  return Object.entries(optionValues)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, value]) => `${title}:${value}`)
    .join("|");
}

export function buildVariantMatrix(input: {
  options: ProductOptionDraft[];
  defaults: VariantDefaults;
  overrides: Map<string, VariantOverride>;
}): VariantMatrixRow[] {
  const normalized = input.options
    .map((option) => ({
      title: option.title.trim(),
      values: option.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((option) => option.title && option.values.length);

  if (!normalized.length) {
    const key = "default";
    const override = input.overrides.get(key);
    return [
      {
        key,
        optionValues: {},
        sku: override?.sku ?? input.defaults.skuPrefix.trim(),
        priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
        currencyCode: input.defaults.currencyCode,
        stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
      },
    ];
  }

  const combinations = normalized.reduce<Array<Record<string, string>>>(
    (rows, option) =>
      rows.flatMap((row) =>
        option.values.map((value) => ({
          ...row,
          [option.title]: value,
        })),
      ),
    [{}],
  );

  return combinations.map((optionValues) => {
    const key = getVariantMatrixKey(optionValues);
    const override = input.overrides.get(key);
    const skuSuffix = Object.values(optionValues)
      .map((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "-"))
      .join("-");
    const skuPrefix = input.defaults.skuPrefix.trim();

    return {
      key,
      optionValues,
      sku: override?.sku ?? [skuPrefix, skuSuffix].filter(Boolean).join("-"),
      priceAmount: override?.priceAmount ?? input.defaults.priceAmount,
      currencyCode: input.defaults.currencyCode,
      stockedQuantity: override?.stockedQuantity ?? input.defaults.stockedQuantity,
    };
  });
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/features/products/product-variant-matrix.test.ts
```

Expected: tests pass.

### Task 6: Update Dashboard Product Payload Parsing

**Files:**
- Modify: `apps/dashboard/src/lib/product-form-data.ts`
- Modify: `apps/dashboard/src/lib/product-form-data.test.ts`
- Modify: `apps/dashboard/src/lib/merchant-products.ts`

- [ ] **Step 1: Add parser tests for variant payloads**

Add a test that posts hidden fields using indexed variant names:

```ts
test("parses generated variant matrix rows", () => {
  const formData = new FormData();
  formData.set("title", "T-shirt");
  formData.set("options", JSON.stringify([{ title: "Size", values: ["S", "M"] }]));
  formData.set(
    "variants",
    JSON.stringify([
      {
        optionValues: { Size: "S" },
        sku: "TEE-S",
        priceAmount: 25,
        currencyCode: "usd",
        stockedQuantity: 4,
      },
      {
        optionValues: { Size: "M" },
        sku: "TEE-M",
        priceAmount: 27,
        currencyCode: "usd",
        stockedQuantity: 7,
      },
    ]),
  );

  assert.deepEqual(getProductFormInput(formData).variants, [
    {
      optionValues: { Size: "S" },
      sku: "TEE-S",
      priceAmount: 25,
      currencyCode: "usd",
      stockedQuantity: 4,
    },
    {
      optionValues: { Size: "M" },
      sku: "TEE-M",
      priceAmount: 27,
      currencyCode: "usd",
      stockedQuantity: 7,
    },
  ]);
});
```

- [ ] **Step 2: Implement JSON parsing for options and variants**

Replace the single-option parser with JSON-first parsing:

```ts
function getProductOptions(formData: FormData) {
  const jsonValue = formData.get("options");
  if (typeof jsonValue === "string" && jsonValue.trim()) {
    return parseJsonArray(jsonValue)
      .map((option) => ({
        title: typeof option.title === "string" ? option.title.trim() : "",
        values: Array.isArray(option.values)
          ? option.values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
          : [],
      }))
      .filter((option) => option.title && option.values.length);
  }

  const title = getOptionalString(formData, "optionTitle");
  const values = getOptionValues(formData);
  return title && values.length ? [{ title, values }] : undefined;
}

function getProductVariants(formData: FormData) {
  const value = formData.get("variants");
  if (typeof value !== "string" || !value.trim()) return undefined;

  const variants = parseJsonArray(value)
    .map((variant) => ({
      optionValues: isRecord(variant.optionValues) ? stringifyRecord(variant.optionValues) : {},
      sku: typeof variant.sku === "string" && variant.sku.trim() ? variant.sku.trim() : null,
      priceAmount: typeof variant.priceAmount === "number" ? variant.priceAmount : Number.NaN,
      currencyCode: typeof variant.currencyCode === "string" ? variant.currencyCode.trim() : "",
      stockedQuantity: typeof variant.stockedQuantity === "number" ? variant.stockedQuantity : undefined,
    }))
    .filter((variant) => Number.isFinite(variant.priceAmount) && variant.currencyCode);

  return variants.length ? variants : undefined;
}
```

Include small local helpers `parseJsonArray`, `isRecord`, and `stringifyRecord`.

- [ ] **Step 3: Include variants in `getProductFormInput`**

```ts
variants: getProductVariants(formData),
```

- [ ] **Step 4: Update dashboard write input type**

In `merchant-products.ts`, add:

```ts
variants?: Array<{
  optionValues: Record<string, string>;
  sku?: string | null | undefined;
  priceAmount: number;
  currencyCode: string;
  stockedQuantity?: number | undefined;
}> | undefined;
```

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/lib/product-form-data.test.ts src/features/products/product-variant-matrix.test.ts
```

Expected: tests pass.

### Task 7: Build Product Options And Variant Matrix UI

**Files:**
- Modify: `apps/dashboard/src/features/products/product-form.tsx`
- Modify: `apps/dashboard/src/features/products/product-form-fields.tsx`

- [ ] **Step 1: Add form value fields**

Change `ProductFormValues` from single `optionTitle` and `optionValues` to:

```ts
type ProductFormValues = {
  title: string;
  handle: string;
  description: string;
  thumbnail: string;
  imageUrls: string;
  status: "draft" | "published";
  options: Array<{ title: string; values: string[] }>;
  variantDefaults: {
    priceAmount: number;
    currencyCode: string;
    stockedQuantity: number;
    skuPrefix: string;
  };
  variantOverrides: Record<string, { sku?: string; priceAmount?: number; stockedQuantity?: number }>;
  collectionId: string;
  categoryIds: string[];
};
```

- [ ] **Step 2: Change composer steps**

Use four steps:

```ts
type ComposerStep = {
  id: "details" | "organize" | "variants" | "review";
  label: string;
};

const PRODUCT_STEPS: ComposerStep[] = [
  { id: "details", label: "Details" },
  { id: "organize", label: "Organization" },
  { id: "variants", label: "Variants" },
  { id: "review", label: "Review" },
];
```

- [ ] **Step 3: Add hidden JSON fields before submit**

In the form render, include:

```tsx
<input name="options" type="hidden" value={JSON.stringify(form.state.values.options)} />
<input name="variants" type="hidden" value={JSON.stringify(variantRows)} />
```

where `variantRows` comes from `buildVariantMatrix`.

- [ ] **Step 4: Add option builder controls**

Create a reusable component in `product-form-fields.tsx`:

```tsx
export function ProductOptionsBuilder({
  options,
  onChange,
}: {
  options: Array<{ title: string; values: string[] }>;
  onChange: (options: Array<{ title: string; values: string[] }>) => void;
}) {
  return (
    <div className="space-y-3">
      {options.map((option, optionIndex) => (
        <div className="rounded-md border p-3" key={optionIndex}>
          <Input
            aria-label="Option name"
            placeholder="Option name"
            value={option.title}
            onChange={(event) => {
              const next = [...options];
              next[optionIndex] = { ...option, title: event.target.value };
              onChange(next);
            }}
          />
          <Textarea
            aria-label="Option values"
            className="mt-2"
            placeholder="One value per line"
            value={option.values.join("\n")}
            onChange={(event) => {
              const next = [...options];
              next[optionIndex] = {
                ...option,
                values: event.target.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean),
              };
              onChange(next);
            }}
          />
          <Button
            className="mt-2"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onChange(options.filter((_, index) => index !== optionIndex))}
          >
            Remove option
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onChange([...options, { title: "", values: [] }])}
      >
        Add option
      </Button>
    </div>
  );
}
```

Use existing local `Button`, `Input`, and `Textarea` imports.

- [ ] **Step 5: Add variant defaults and matrix table**

In the variants step, render:

```tsx
<div className="grid gap-3 md:grid-cols-4">
  <Input name="variantPriceAmount" type="number" min={0} value={form.state.values.variantDefaults.priceAmount} />
  <Input name="variantCurrencyCode" value={form.state.values.variantDefaults.currencyCode} />
  <Input name="variantStockedQuantity" type="number" min={0} value={form.state.values.variantDefaults.stockedQuantity} />
  <Input name="variantSkuPrefix" value={form.state.values.variantDefaults.skuPrefix} />
</div>
<VariantMatrixTable rows={variantRows} onOverrideChange={setVariantOverride} />
```

Implement `VariantMatrixTable` in the same file initially to keep scope contained. Split it later only if the file becomes difficult to review.

- [ ] **Step 6: Run dashboard tests and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit product creation UI**

```bash
git add apps/dashboard/src/features/products/product-form.tsx apps/dashboard/src/features/products/product-form-fields.tsx apps/dashboard/src/features/products/product-variant-matrix.ts apps/dashboard/src/features/products/product-variant-matrix.test.ts apps/dashboard/src/lib/product-form-data.ts apps/dashboard/src/lib/product-form-data.test.ts apps/dashboard/src/lib/merchant-products.ts
git commit -m "feat: add product variant matrix composer"
```

## Phase 3: Product Detail Editing And Variant Controls

### Task 8: Add Dashboard Variant Stock Client Helpers

**Files:**
- Modify: `apps/dashboard/src/lib/merchant-products.ts`

- [ ] **Step 1: Add client helper types**

```ts
export async function getMerchantProductVariantStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
  variantId: string;
}): Promise<MerchantProductStockResult> {
  const response = await (options.fetcher ?? fetch)(
    `${options.platformApiBaseUrl}/platform/merchant/products/${encodeURIComponent(options.productId)}/variants/${encodeURIComponent(options.variantId)}/stock`,
    {
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        requestHost: options.requestHost,
        tenantId: options.tenantId,
      }),
      cache: "no-store",
    },
  );

  return parseProductStockResponse(response);
}
```

- [ ] **Step 2: Add update helper**

```ts
export async function updateMerchantProductVariantStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  stockedQuantity: number;
  tenantId?: string | null | undefined;
  variantId: string;
}): Promise<MerchantProductStockResult> {
  const response = await (options.fetcher ?? fetch)(
    `${options.platformApiBaseUrl}/platform/merchant/products/${encodeURIComponent(options.productId)}/variants/${encodeURIComponent(options.variantId)}/stock`,
    {
      method: "POST",
      headers: {
        ...getProductHeaders({
          cookieHeader: options.cookieHeader,
          requestHost: options.requestHost,
          tenantId: options.tenantId,
        }),
        "content-type": "application/json",
      },
      body: JSON.stringify({ stockedQuantity: options.stockedQuantity }),
    },
  );

  return parseProductStockResponse(response);
}
```

- [ ] **Step 3: Run dashboard typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard typecheck
```

Expected: passes.

### Task 9: Replace Product Edit Composer With Detail Sections

**Files:**
- Modify: `apps/dashboard/src/features/products/product-detail.tsx`
- Modify: `apps/dashboard/src/features/products/product-edit-dialog.tsx`
- Modify: `apps/dashboard/src/features/products/product-stock-panel.tsx`

- [ ] **Step 1: Rename composer edit entry point**

Keep `product-edit-dialog.tsx` temporarily, but change its exported UI to a focused general-fields dialog. The dialog should edit title, handle, description, status, thumbnail, collection, and categories only.

- [ ] **Step 2: Add variant stock action controls**

Update `ProductVariantsTable` rows to show editable stock controls when `inventoryItemId` exists:

```tsx
<ProductVariantStockControl
  productId={product.id}
  variantId={variant.id}
  initialStock={variant.stock}
/>
```

- [ ] **Step 3: Use variant stock endpoint in stock control**

In `product-stock-panel.tsx`, add a variant mode:

```ts
type ProductStockPanelProps = {
  productId: string;
  variantId?: string | undefined;
  initialStock?: MerchantProductStock | undefined;
  action: string;
  stockError?: string | undefined;
};
```

When `variantId` is present, post to:

```ts
dashboardRoutes.productVariantStockAction(productId, variantId, tenantId)
```

Add the route helper if it does not exist.

- [ ] **Step 4: Run dashboard tests and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit detail editing**

```bash
git add apps/dashboard/src/features/products/product-detail.tsx apps/dashboard/src/features/products/product-edit-dialog.tsx apps/dashboard/src/features/products/product-stock-panel.tsx apps/dashboard/src/lib/merchant-products.ts apps/dashboard/src/lib/navigation.ts
git commit -m "feat: add focused product variant editing"
```

## Phase 4: Product And Order Filters

### Task 10: Extend Product Table Filters

**Files:**
- Modify: `apps/dashboard/src/features/products/product-table-state.ts`
- Modify: `apps/dashboard/src/features/products/product-table-state.test.ts`
- Modify: `apps/dashboard/src/features/products/products-table.tsx`

- [ ] **Step 1: Add product filter tests**

Add tests for:

```ts
test("filters products by multi-variant state", () => {
  const result = filterProductsForTable(products, {
    query: "",
    status: "all",
    variantCount: "multi",
    stockState: "all",
    collectionId: "all",
    categoryId: "all",
  });
  assert.deepEqual(result.map((product) => product.id), ["prod_multi"]);
});

test("filters products by out of stock state", () => {
  const result = filterProductsForTable(products, {
    query: "",
    status: "all",
    variantCount: "all",
    stockState: "out",
    collectionId: "all",
    categoryId: "all",
  });
  assert.deepEqual(result.map((product) => product.id), ["prod_out"]);
});
```

- [ ] **Step 2: Extend filter types**

```ts
export type ProductVariantCountFilter = "all" | "single" | "multi";
export type ProductStockStateFilter = "all" | "in" | "low" | "out" | "unmanaged";

export type ProductTableFilterInput = {
  query: string;
  status: ProductStatusFilter;
  variantCount: ProductVariantCountFilter;
  stockState: ProductStockStateFilter;
  collectionId: string;
  categoryId: string;
};
```

- [ ] **Step 3: Add filter predicates**

```ts
function productMatchesVariantCount(product: MerchantProduct, filter: ProductVariantCountFilter) {
  const count = product.variants?.length ?? 0;
  if (filter === "single") return count <= 1;
  if (filter === "multi") return count > 1;
  return true;
}

function productMatchesStockState(product: MerchantProduct, filter: ProductStockStateFilter) {
  if (filter === "all") return true;
  const stocks = (product.variants ?? []).map((variant) => variant.stock).filter(Boolean);
  if (!stocks.length) return filter === "unmanaged";
  const available = stocks.reduce((sum, stock) => sum + (stock?.availableQuantity ?? 0), 0);
  if (filter === "out") return available <= 0;
  if (filter === "low") return available > 0 && available <= 5;
  if (filter === "in") return available > 5;
  return false;
}
```

- [ ] **Step 4: Add UI filter controls**

Use the existing `DataTableFilters` pattern in `products-table.tsx` and add options for collection, category, stock state, and variant count.

- [ ] **Step 5: Run dashboard tests**

Run:

```bash
pnpm --filter @ecs/dashboard test -- src/features/products/product-table-state.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

### Task 11: Extend Order Table Filters

**Files:**
- Modify: `apps/dashboard/src/features/orders/order-table-state.ts`
- Modify: `apps/dashboard/src/features/orders/order-table-state.test.ts`
- Modify: `apps/dashboard/src/features/orders/orders-table.tsx`

- [ ] **Step 1: Add order filter tests**

Add tests for payment, fulfillment, date, and total filters:

```ts
test("filters orders by payment and fulfillment status", () => {
  const result = filterOrdersForTable(orders, {
    query: "",
    lifecycle: "all",
    paymentStatus: "captured",
    fulfillmentStatus: "fulfilled",
    dateFrom: "",
    dateTo: "",
    totalMin: "",
    totalMax: "",
  });
  assert.deepEqual(result.map((order) => order.id), ["order_paid_fulfilled"]);
});
```

- [ ] **Step 2: Extend filter input**

```ts
export type OrderTableFilterInput = {
  query: string;
  lifecycle: OrderLifecycleFilter;
  paymentStatus: string;
  fulfillmentStatus: string;
  dateFrom: string;
  dateTo: string;
  totalMin: string;
  totalMax: string;
};
```

- [ ] **Step 3: Add predicates for dates and totals**

```ts
function orderMatchesDateRange(order: MerchantOrder, from: string, to: string) {
  const value = order.createdAt ? Date.parse(order.createdAt) : Number.NaN;
  if (!Number.isFinite(value)) return !from && !to;
  if (from && value < Date.parse(from)) return false;
  if (to && value > Date.parse(to)) return false;
  return true;
}

function orderMatchesTotalRange(order: MerchantOrder, min: string, max: string) {
  const total = order.total ?? 0;
  const minValue = min.trim() ? Number(min) : null;
  const maxValue = max.trim() ? Number(max) : null;
  if (minValue !== null && total < minValue) return false;
  if (maxValue !== null && total > maxValue) return false;
  return true;
}
```

- [ ] **Step 4: Add UI filters**

Add payment status, fulfillment status, date range, and total range controls using the existing table filter components.

- [ ] **Step 5: Run dashboard tests**

```bash
pnpm --filter @ecs/dashboard test -- src/features/orders/order-table-state.test.ts
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit filters**

```bash
git add apps/dashboard/src/features/products/product-table-state.ts apps/dashboard/src/features/products/product-table-state.test.ts apps/dashboard/src/features/products/products-table.tsx apps/dashboard/src/features/orders/order-table-state.ts apps/dashboard/src/features/orders/order-table-state.test.ts apps/dashboard/src/features/orders/orders-table.tsx
git commit -m "feat: add practical merchant table filters"
```

## Phase 5: Taxonomy Creation Modals

### Task 12: Move Category And Collection Creation Into Modals

**Files:**
- Modify: `apps/dashboard/src/features/catalog-taxonomy/product-categories-table.tsx`
- Modify: `apps/dashboard/src/features/catalog-taxonomy/product-collections-table.tsx`
- Modify: `apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx`
- Modify: `apps/dashboard/src/lib/taxonomy-form-data.ts`

- [ ] **Step 1: Extract reusable modal shell**

Create a local `TaxonomyCreateDialog` component in `taxonomy-form.tsx`:

```tsx
export function TaxonomyCreateDialog({
  action,
  children,
  description,
  submitLabel,
  title,
  triggerLabel,
}: {
  action: string;
  children: React.ReactNode;
  description: string;
  submitLabel: string;
  title: string;
  triggerLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Use modal from category table**

Replace create page links with:

```tsx
<TaxonomyCreateDialog
  action={dashboardRoutes.productCategoriesCreateAction(tenantId)}
  description="Create a category for grouping products in this shop."
  submitLabel="Create category"
  title="Create category"
  triggerLabel="Create category"
>
  <CategoryFormFields categories={categories} />
</TaxonomyCreateDialog>
```

- [ ] **Step 3: Use modal from collection table**

```tsx
<TaxonomyCreateDialog
  action={dashboardRoutes.productCollectionsCreateAction(tenantId)}
  description="Create a collection for merchandising related products."
  submitLabel="Create collection"
  title="Create collection"
  triggerLabel="Create collection"
>
  <CollectionFormFields />
</TaxonomyCreateDialog>
```

- [ ] **Step 4: Run dashboard tests and typecheck**

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit taxonomy modals**

```bash
git add apps/dashboard/src/features/catalog-taxonomy/product-categories-table.tsx apps/dashboard/src/features/catalog-taxonomy/product-collections-table.tsx apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx apps/dashboard/src/lib/taxonomy-form-data.ts
git commit -m "feat: add taxonomy creation modals"
```

## Final Verification

## Testing Coverage Map

- Contract coverage comes from `pnpm --filter @ecs/contracts typecheck`; Zod schemas must be imported by platform and dashboard code without type errors.
- Platform route coverage lives in `apps/platform-api/src/app.test.ts` and proves the new variant stock routes pass tenant context, product ID, variant ID, and stock location into service callbacks.
- Platform service coverage lives in `apps/platform-api/src/commerce/product-service.test.ts` and proves Medusa inventory item resolution works for a selected variant in a multi-variant product.
- Dashboard pure logic coverage lives in `apps/dashboard/src/features/products/product-variant-matrix.test.ts`, `product-form-data.test.ts`, `product-table-state.test.ts`, and `order-table-state.test.ts`.
- Dashboard type coverage comes from `pnpm --filter @ecs/dashboard typecheck`, which must pass after component and route-helper changes.

- [ ] **Step 1: Run all focused checks**

```bash
pnpm --filter @ecs/contracts typecheck
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: all commands pass.

- [ ] **Step 2: Run workspace checks**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all commands pass.

- [ ] **Step 3: Manual dashboard smoke test**

Start the app stack using the existing project workflow, then verify:

- product creation accepts two option groups and displays generated variants
- defaults apply price, SKU prefix, and stock to every generated variant
- a row override changes only that variant payload
- product detail shows variants with SKU, price, and stock state
- updating stock for one variant does not update another variant
- product filters narrow by stock state and variant count
- order filters narrow by payment and fulfillment status
- category and collection create actions open modals from their tables

- [ ] **Step 4: Commit final fixes if verification changes files**

```bash
git status --short
git add <changed-files-from-verification>
git commit -m "fix: polish variant stock management"
```

Only run the final commit step if verification requires follow-up file changes.
