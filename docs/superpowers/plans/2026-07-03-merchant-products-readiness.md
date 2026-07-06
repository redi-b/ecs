# Merchant Products Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real merchant product workflow in the dashboard while making local commerce setup failures clear and actionable.

**Architecture:** Dashboard product pages continue to call Platform API only; Platform API remains the commerce boundary and Medusa client. The implementation expands dashboard product helpers/forms around the existing Platform API merchant product endpoints, then tightens readiness/error mapping without adding direct Medusa access to the dashboard.

**Tech Stack:** Next.js App Router, React server components, shadcn/ui, TanStack Table, Hono Platform API, Medusa, Node test runner, TypeScript.

---

## File Structure

- Modify `apps/dashboard/src/lib/list-error-state.ts`: map commerce setup/backend/context/resource errors to operator-readable states.
- Modify `apps/dashboard/src/lib/list-error-state.test.ts`: cover all mapped product/order setup states.
- Modify `apps/dashboard/src/lib/merchant-products.ts`: add rich product write fields plus product detail, category list, and collection list helpers.
- Modify `apps/dashboard/src/lib/merchant-products.test.ts`: cover helper URLs, payloads, invalid responses, and setup failures.
- Modify `packages/contracts/src/index.ts`: add category/collection response schemas only if no exported schemas already exist for the Platform API responses.
- Modify `apps/dashboard/src/lib/routes.ts`: add product detail/create route helpers.
- Create `apps/dashboard/src/lib/product-form-data.ts`: normalize product form data for create/edit route handlers.
- Create `apps/dashboard/src/lib/product-form-data.test.ts`: cover empty strings, repeated categories, newline image URLs, and numeric price parsing.
- Modify `apps/dashboard/src/features/products/products-table.tsx`: add product row links and richer price/media/status signals.
- Create `apps/dashboard/src/features/products/product-form.tsx`: reusable shadcn-based product create/edit form.
- Create `apps/dashboard/src/features/products/product-detail.tsx`: product detail/read-only summary surface.
- Modify `apps/dashboard/src/app/admin/(dashboard)/products/page.tsx`: add create action, success/error notices, empty state, and improved setup state.
- Create `apps/dashboard/src/app/admin/(dashboard)/products/new/page.tsx`: product create page.
- Create `apps/dashboard/src/app/admin/(dashboard)/products/[productId]/page.tsx`: product detail/edit page.
- Modify `apps/dashboard/src/app/admin/products/create/route.ts`: forward rich product form fields.
- Modify `apps/dashboard/src/app/admin/products/[productId]/route.ts`: forward rich product form fields.
- Modify `apps/platform-api/src/app.test.ts`: add or extend Platform API coverage only for readiness errors and product write fields not already covered.
- Modify `apps/platform-api/src/commerce/product-service.test.ts`: add Medusa resource/error coverage only if the service cannot currently distinguish resource-missing failures.
- Modify `apps/platform-api/src/commerce/product-service.ts`: normalize missing Medusa resources only if required by the failing test.

## Task 1: Dashboard Commerce Setup-State Mapping

**Files:**
- Modify: `apps/dashboard/src/lib/list-error-state.test.ts`
- Modify: `apps/dashboard/src/lib/list-error-state.ts`

- [ ] **Step 1: Write failing tests for setup and service states**

Add cases that expect product/order pages to map these errors:

```ts
assert.deepEqual(getListErrorState("products", "commerce_credentials_missing"), {
  kind: "setup",
  title: "Medusa admin token is not configured",
  description:
    "Start Platform API with MEDUSA_ADMIN_API_TOKEN from the Medusa seed before loading live product data.",
});

assert.deepEqual(getListErrorState("products", "commerce_sales_channel_unavailable"), {
  kind: "setup",
  title: "Product sales channel is not configured",
  description:
    "This tenant is missing its Medusa sales channel mapping. Re-run provisioning or seed data, then reload products.",
});

assert.deepEqual(getListErrorState("products", "commerce_region_unavailable"), {
  kind: "setup",
  title: "Commerce region is not configured",
  description:
    "This tenant is missing its Medusa region mapping. Re-run provisioning or seed data, then reload products.",
});

assert.deepEqual(getListErrorState("products", "commerce_resource_missing"), {
  kind: "setup",
  title: "Commerce resources are out of sync",
  description:
    "The tenant has Medusa resource IDs, but Medusa did not return the expected resources. Re-run local commerce provisioning or seed data.",
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/list-error-state.test.ts`

Expected: FAIL because the new mappings are not implemented.

- [ ] **Step 3: Implement explicit mapping**

Update `getListErrorState` with a small `switch` or lookup table. Keep `platform_request_failed` mapped to a service state and unknown messages mapped to `kind: "error"`.

```ts
if (message === "platform_request_failed") {
  return {
    kind: "service",
    title: "Platform API is unavailable",
    description: `The dashboard could not reach Platform API. Start the API service, then reload ${kind}.`,
  };
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/list-error-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/list-error-state.ts apps/dashboard/src/lib/list-error-state.test.ts
git commit -m "fix: clarify commerce setup states"
```

## Task 2: Product Helper Contract Expansion

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/dashboard/src/lib/merchant-products.test.ts`
- Modify: `apps/dashboard/src/lib/merchant-products.ts`

- [ ] **Step 1: Write failing tests for rich product payloads**

Extend the create/update tests to assert this JSON body:

```ts
{
  title: "Coffee",
  description: "Roasted coffee beans",
  handle: "coffee",
  collectionId: "pcol_1",
  categoryIds: ["pcat_1"],
  imageUrls: ["https://cdn.test/coffee.jpg"],
  priceAmount: 350,
  currencyCode: "etb",
  status: "draft",
  thumbnail: "https://cdn.test/thumb.jpg",
}
```

- [ ] **Step 2: Write failing tests for product detail, category, and collection helpers**

Add tests for:

```ts
await getMerchantProduct({
  cookieHeader: "better-auth.session_token=session_1",
  platformApiBaseUrl: "http://platform.local",
  productId: "prod_1",
  tenantId: "tenant_1",
  fetcher,
});
```

Expected URL: `http://platform.local/platform/tenants/tenant_1/products/prod_1`

Add list helpers:

```ts
await getMerchantProductCategories({ platformApiBaseUrl, tenantId, fetcher });
await getMerchantProductCollections({ platformApiBaseUrl, tenantId, fetcher });
```

Expected URLs:

- `http://platform.local/platform/tenants/tenant_1/product-categories?limit=100&offset=0`
- `http://platform.local/platform/tenants/tenant_1/product-collections?limit=100&offset=0`

Expected parsed category item:

```ts
{
  id: "pcat_1",
  name: "Coffee",
  handle: "coffee",
  isActive: true,
  isInternal: false,
  parentCategoryId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
}
```

Expected parsed collection item:

```ts
{
  id: "pcol_1",
  title: "Featured",
  handle: "featured",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
}
```

- [ ] **Step 3: Run focused tests and confirm they fail**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/merchant-products.test.ts`

Expected: FAIL because helper functions/types do not exist or payload fields are omitted.

- [ ] **Step 4: Implement helper types and functions**

Expand `MerchantProductWriteInput`:

```ts
export type MerchantProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  priceAmount?: number | undefined;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
};
```

Add `getMerchantProduct`, `getMerchantProductCategories`, and `getMerchantProductCollections`. Reuse `getProductHeaders`, `normalizeBaseUrl`, and the existing result-union style. If `packages/contracts/src/index.ts` does not already export category/collection list schemas, add them next to `merchantProductsSchema` and import them from the dashboard helper.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/merchant-products.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/index.ts apps/dashboard/src/lib/merchant-products.ts apps/dashboard/src/lib/merchant-products.test.ts
git commit -m "feat: expand merchant product client helpers"
```

## Task 3: Product Routes and Form Parsing

**Files:**
- Modify: `apps/dashboard/src/app/admin/products/create/route.ts`
- Modify: `apps/dashboard/src/app/admin/products/[productId]/route.ts`
- Modify: `apps/dashboard/src/lib/routes.ts`
- Create: `apps/dashboard/src/lib/product-form-data.ts`
- Create: `apps/dashboard/src/lib/product-form-data.test.ts`

- [ ] **Step 1: Add route constants**

Add route helpers:

```ts
productsNew: "/admin/products/new",
productDetail: (productId: string) => `/admin/products/${encodeURIComponent(productId)}`,
```

- [ ] **Step 2: Write failing tests for form payload parsing**

Create `apps/dashboard/src/lib/product-form-data.test.ts` and verify form values normalize as:

```ts
{
  title: "Coffee",
  description: "Roasted coffee beans",
  handle: "coffee",
  collectionId: "pcol_1",
  categoryIds: ["pcat_1", "pcat_2"],
  imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"],
  priceAmount: 350,
  currencyCode: "etb",
  status: "draft",
  thumbnail: "https://cdn.test/thumb.jpg",
}
```

Use newline-separated `imageUrls` in the form input and repeated `categoryIds` values.

Also assert empty values normalize to the expected API shape:

```ts
{
  title: null,
  description: null,
  handle: null,
  collectionId: null,
  categoryIds: [],
  imageUrls: [],
  priceAmount: undefined,
  currencyCode: null,
  status: null,
  thumbnail: null,
}
```

- [ ] **Step 3: Run focused dashboard tests and confirm they fail**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/product-form-data.test.ts`

Expected: FAIL because route/form parsing does not forward rich fields.

- [ ] **Step 4: Implement shared parser**

Create `apps/dashboard/src/lib/product-form-data.ts` with:

```ts
export function getProductFormInput(formData: FormData): MerchantProductWriteInput {
  return {
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    handle: getFormString(formData, "handle"),
    collectionId: getFormString(formData, "collectionId"),
    categoryIds: getFormStringArray(formData, "categoryIds"),
    imageUrls: getTextList(formData, "imageUrls"),
    priceAmount: getOptionalNumber(formData, "priceAmount"),
    currencyCode: getFormString(formData, "currencyCode"),
    status: getFormString(formData, "status"),
    thumbnail: getFormString(formData, "thumbnail"),
  };
}
```

Use `formData.getAll("categoryIds")` for categories. Split `imageUrls` on newlines, trim each row, and drop blanks. Parse `priceAmount` with `Number.parseInt(value, 10)` and return `undefined` when the field is blank or not a nonnegative integer.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run: `pnpm --filter @ecs/dashboard test -- src/lib/product-form-data.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/admin/products/create/route.ts apps/dashboard/src/app/admin/products/[productId]/route.ts apps/dashboard/src/lib/routes.ts apps/dashboard/src/lib/product-form-data.ts apps/dashboard/src/lib/product-form-data.test.ts
git commit -m "feat: forward merchant product form fields"
```

## Task 4: Product Form Component

**Files:**
- Create: `apps/dashboard/src/features/products/product-form.tsx`
- Modify: `apps/dashboard/src/features/products/products-table.tsx`

- [ ] **Step 1: Create reusable form component**

Build `ProductForm` with shadcn `Field`, `Input`, `Textarea`, `Button`, and existing dashboard card styling.

Props:

```ts
type ProductFormProps = {
  action: string;
  categories: Array<{ id: string; name: string; handle: string | null }>;
  collections: Array<{ id: string; title: string; handle: string | null }>;
  product?: MerchantProduct | undefined;
  submitLabel: string;
};
```

Fields:

- `title` required.
- `handle`.
- `description`.
- `status` as a native select with `draft` and `published`.
- `thumbnail`.
- `imageUrls` as newline-separated textarea.
- `priceAmount` numeric input.
- `currencyCode` default `etb`.
- `collectionId` native select.
- `categoryIds` checkbox list.

- [ ] **Step 2: Keep controls visually aligned with shell**

Use:

```tsx
<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
```

Use rounded `2xl` containers sparingly and avoid nesting cards inside cards.

- [ ] **Step 3: Typecheck the component**

Run: `pnpm --filter @ecs/dashboard typecheck`

Expected: PASS after imports and prop types are correct.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/features/products/product-form.tsx apps/dashboard/src/features/products/products-table.tsx
git commit -m "feat: add merchant product form"
```

## Task 5: Product List UX

**Files:**
- Modify: `apps/dashboard/src/app/admin/(dashboard)/products/page.tsx`
- Modify: `apps/dashboard/src/features/products/products-table.tsx`
- Modify: `apps/dashboard/src/components/app/data-table.tsx` only if row action support is necessary.

- [ ] **Step 1: Add create action and result notices**

In `ProductsPage`, pass `actions` to `PageShell`:

```tsx
<Button asChild>
  <Link href={getTenantScopedPath(dashboardRoutes.productsNew, tenantId)}>New product</Link>
</Button>
```

Show a success `Alert` for:

- `product_created`
- `product_updated`

Show a destructive `Alert` for product mutation errors that are not setup states.

- [ ] **Step 2: Link product rows to detail pages**

In `ProductsTable`, render the product title as:

```tsx
<Link href={dashboardRoutes.productDetail(product.id)} className="font-medium text-foreground hover:text-primary">
  {product.title ?? "Untitled product"}
</Link>
```

Preserve tenant query params when `tenantId` is present by passing a scoped base path from the page if needed.

- [ ] **Step 3: Add price/media signals**

Render the first variant price when present:

```ts
const price = product.variants?.flatMap((variant) => variant.prices)[0];
```

Display `ETB 350` style copy when amount and currency exist; otherwise show `No price`.

- [ ] **Step 4: Run dashboard tests and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/dashboard/src/app/admin/(dashboard)/products/page.tsx' apps/dashboard/src/features/products/products-table.tsx apps/dashboard/src/components/app/data-table.tsx
git commit -m "feat: improve merchant product list"
```

## Task 6: Product Create Page

**Files:**
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/new/page.tsx`
- Modify: `apps/dashboard/src/lib/merchant-products.ts`

- [ ] **Step 1: Create the page**

The page should:

- Resolve cookies, host, and selected tenant.
- Load categories and collections through Platform API.
- Render `ProductForm`.
- Use action URL `/admin/products/create` with selected tenant query params.
- Render setup state if category/collection loading returns commerce setup errors.

- [ ] **Step 2: Fail gracefully when categories/collections are unavailable**

If categories or collections fail with a non-setup error, render an `Alert` and keep the product form available with empty option lists only when the failure is not required for basic product creation.

- [ ] **Step 3: Run dashboard typecheck**

Run: `pnpm --filter @ecs/dashboard typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add 'apps/dashboard/src/app/admin/(dashboard)/products/new/page.tsx' apps/dashboard/src/lib/merchant-products.ts
git commit -m "feat: add merchant product creation page"
```

## Task 7: Product Detail and Edit Page

**Files:**
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/[productId]/page.tsx`
- Create: `apps/dashboard/src/features/products/product-detail.tsx`
- Modify: `apps/dashboard/src/lib/merchant-products.ts`

- [ ] **Step 1: Create detail component**

`ProductDetail` renders:

- Product title, handle, status, and thumbnail.
- Description.
- Images.
- Collection/category IDs until names are available.
- Variant count.
- First price signal.
- Created/updated timestamps.

- [ ] **Step 2: Create detail/edit page**

The page should:

- Load product detail.
- Load categories and collections.
- Render `ProductDetail`.
- Render `ProductForm` prefilled with the product.
- Use action URL `/admin/products/${product.id}` with selected tenant query params.

- [ ] **Step 3: Keep stock read-only**

Do not add stock mutation controls in this task. If stock is shown, it must be read-only and can be omitted if it requires additional helper work.

- [ ] **Step 4: Run dashboard tests and typecheck**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/dashboard/src/app/admin/(dashboard)/products/[productId]/page.tsx' apps/dashboard/src/features/products/product-detail.tsx apps/dashboard/src/lib/merchant-products.ts
git commit -m "feat: add merchant product detail page"
```

## Task 8: Platform API Readiness Normalization

**Files:**
- Modify: `apps/platform-api/src/app.test.ts`
- Modify: `apps/platform-api/src/commerce/product-service.test.ts` if required.
- Modify: `apps/platform-api/src/commerce/product-service.ts` if required.

- [ ] **Step 1: Audit existing failing states**

Run focused platform tests:

```bash
pnpm --filter @ecs/platform-api test -- src/app.test.ts
pnpm --filter @ecs/platform-api test -- src/commerce/product-service.test.ts
```

Expected: PASS before changes. If already failing, stop and diagnose before editing.

- [ ] **Step 2: Add only missing readiness tests**

Add tests for any spec state that is not already covered:

- Missing admin token returns `commerce_credentials_missing`.
- Missing sales channel returns `commerce_sales_channel_unavailable`.
- Missing region returns `commerce_region_unavailable`.
- Medusa returns not found for expected product resource maps to `commerce_resource_missing` only if the service can distinguish it from backend unavailability.

- [ ] **Step 3: Implement minimal normalization**

Do not add a new readiness endpoint unless the tests prove list/create/detail cannot express the needed setup state. Prefer mapping existing service failures into the existing `{ ok: false, error, status }` shape.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @ecs/platform-api test -- src/app.test.ts
pnpm --filter @ecs/platform-api test -- src/commerce/product-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-api/src/app.test.ts apps/platform-api/src/commerce/product-service.test.ts apps/platform-api/src/commerce/product-service.ts
git commit -m "fix: normalize merchant product readiness errors"
```

## Task 9: Final Verification and Manual QA Handoff

**Files:**
- Modify: `README.md` only if the implementation changes local setup commands or adds a clearer local readiness note.

- [ ] **Step 1: Run dashboard verification**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 2: Run platform verification**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/platform-api typecheck
```

Expected: PASS.

- [ ] **Step 3: Run local commerce smoke when services are running**

Run only when Medusa and Platform API are running with `MEDUSA_ADMIN_API_TOKEN`:

```bash
pnpm smoke:commerce
```

Expected: PASS through sign-in, tenant create, category create, collection create, product create, product detail, and stock read.

- [ ] **Step 4: Prepare manual QA notes**

Give the user these URLs and states to inspect:

- `http://abebe.lvh.me/admin/products`
- `http://abebe.lvh.me/admin/products/new`
- Product detail page from a row click.
- Products page with Platform API missing `MEDUSA_ADMIN_API_TOKEN`.
- Products page with Medusa stopped.

- [ ] **Step 5: Commit final docs if changed**

```bash
git add README.md
git commit -m "docs: clarify local commerce readiness"
```

Skip this commit if `README.md` did not change.
