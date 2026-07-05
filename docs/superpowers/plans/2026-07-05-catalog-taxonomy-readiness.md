# Catalog Taxonomy Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class merchant dashboard pages for product categories and collections with list/create workflows.

**Architecture:** Reuse the dashboard table/form patterns built for products and orders. Add the smallest Platform API route support needed for merchant-host create flows because selected-tenant create routes already exist but `/platform/merchant/product-categories` and `/platform/merchant/product-collections` do not.

**Tech Stack:** Next.js App Router, React client components, shadcn UI primitives, Remix icons via `AppIcons`, TanStack Table v8, Hono Platform API routes, `@ecs/contracts`, Node test runner with `tsx`.

---

## File Structure

- Create `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.ts`: pure helpers for collection/category search, counts, date formatting, and display labels.
- Create `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.test.ts`: helper tests.
- Modify `apps/platform-api/src/routes/merchant-routes.ts`: add merchant-host create routes for categories and collections.
- Modify `apps/platform-api/src/app.test.ts` or relevant merchant route tests if existing coverage fits: route tests for merchant taxonomy create behavior.
- Modify `apps/dashboard/src/lib/merchant-products.ts`: add `createMerchantProductCategory` and `createMerchantProductCollection`.
- Modify `apps/dashboard/src/lib/merchant-products.test.ts`: dashboard client create tests.
- Modify `apps/dashboard/src/lib/routes.ts`: add category/collection list, new, and action routes.
- Modify `apps/dashboard/src/lib/navigation.ts`: add Products children for Products, Categories, Collections.
- Modify `apps/dashboard/src/lib/dashboard-breadcrumbs.ts` and test: explicit taxonomy breadcrumbs before generic product detail breadcrumbs.
- Create `apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx`: shared create form with locked/auto-generated handle behavior.
- Create `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table.tsx`: shared table shell for categories and collections.
- Create `apps/dashboard/src/app/admin/(dashboard)/products/categories/page.tsx`
- Create `apps/dashboard/src/app/admin/(dashboard)/products/categories/new/page.tsx`
- Create `apps/dashboard/src/app/admin/product-categories/actions/create/route.ts`
- Create `apps/dashboard/src/app/admin/(dashboard)/products/collections/page.tsx`
- Create `apps/dashboard/src/app/admin/(dashboard)/products/collections/new/page.tsx`
- Create `apps/dashboard/src/app/admin/product-collections/actions/create/route.ts`

Do not implement edit/delete, category tree editing, product assignment changes, variants, or stock in this plan.

---

### Task 1: Taxonomy Table State Helpers

**Files:**
- Create: `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.ts`
- Create: `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.test.ts`

- [ ] **Step 1: Add tests**

Cover:

- collection search by id/title/handle;
- category search by id/name/handle/parent id;
- filtered count state;
- `formatTaxonomyDate(null) === "No date"`;
- invalid date fallback;
- title/name fallback labels.

- [ ] **Step 2: Implement helpers**

Export:

- `filterCollectionsForTable(collections, { query })`
- `filterCategoriesForTable(categories, { query })`
- `getTaxonomyTableCounts({ filteredCount, pageCount, totalCount, query })`
- `formatTaxonomyDate(value)`
- `getCollectionDisplayName(collection)`
- `getCategoryDisplayName(category)`
- `slugifyTaxonomyHandle(value)`

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.ts apps/dashboard/src/features/catalog-taxonomy/taxonomy-table-state.test.ts
git commit -m "test: add catalog taxonomy table helpers"
```

---

### Task 2: Taxonomy Create API And Dashboard Client

**Files:**
- Modify: `apps/platform-api/src/routes/merchant-routes.ts`
- Modify: `apps/platform-api/src/app.test.ts` or existing route test file if a more specific one exists.
- Modify: `apps/dashboard/src/lib/merchant-products.ts`
- Modify: `apps/dashboard/src/lib/merchant-products.test.ts`

- [ ] **Step 1: Add Platform API merchant-host create routes**

Add:

- `POST /platform/merchant/product-categories`
- `POST /platform/merchant/product-collections`

Use the same authorization/commerce resolution pattern as merchant product create routes:

- require dashboard session;
- resolve tenant from request host;
- authorize dashboard access;
- use `merchant.result.context.tenantId`;
- validate `name` for category and `title` for collection;
- forward optional `handle`;
- call `options.createMerchantProductCategory` or `options.createMerchantProductCollection`;
- return `{ category }` or `{ collection }`.

- [ ] **Step 2: Add dashboard client create functions**

In `merchant-products.ts`, add result types and functions:

- `createMerchantProductCategory({ name, handle, cookieHeader, platformApiBaseUrl, requestHost, tenantId, fetcher })`
- `createMerchantProductCollection({ title, handle, cookieHeader, platformApiBaseUrl, requestHost, tenantId, fetcher })`

URL behavior:

- with `tenantId`: `/platform/tenants/:tenantId/product-categories` or `/product-collections`;
- without `tenantId`: `/platform/merchant/product-categories` or `/product-collections`;
- forward cookie and host like products;
- POST JSON with content type.

Invalid response messages:

- `invalid_product_category_response`
- `invalid_product_collection_response`

- [ ] **Step 3: Add tests**

Cover:

- merchant-host create forwards `x-forwarded-host` and cookie;
- tenant create suppresses forwarded host and uses tenant URL;
- invalid category/collection response;
- request failure maps to `platform_request_failed`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/platform-api/src/routes/merchant-routes.ts apps/platform-api/src/app.test.ts apps/dashboard/src/lib/merchant-products.ts apps/dashboard/src/lib/merchant-products.test.ts
git commit -m "feat: add merchant taxonomy create clients"
```

---

### Task 3: Taxonomy Navigation And Breadcrumbs

**Files:**
- Modify: `apps/dashboard/src/lib/routes.ts`
- Modify: `apps/dashboard/src/lib/navigation.ts`
- Modify: `apps/dashboard/src/lib/dashboard-breadcrumbs.ts`
- Modify: `apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts`

- [ ] **Step 1: Add route helpers**

Add:

- `productCategories: "/admin/products/categories"`
- `productCategoriesNew: "/admin/products/categories/new"`
- `productCategoryCreateAction: "/admin/product-categories/actions/create"`
- `productCollections: "/admin/products/collections"`
- `productCollectionsNew: "/admin/products/collections/new"`
- `productCollectionCreateAction: "/admin/product-collections/actions/create"`

- [ ] **Step 2: Add Products children**

Add child routes under Products:

- Products -> `/admin/products`
- Categories -> `/admin/products/categories`
- Collections -> `/admin/products/collections`

Use existing commerce/product icons if no better icon exists.

- [ ] **Step 3: Add explicit breadcrumbs before generic product details**

Breadcrumbs:

- `/admin/products/categories` -> Products > Categories
- `/admin/products/categories/new` -> Products > Categories > New category
- `/admin/products/collections` -> Products > Collections
- `/admin/products/collections/new` -> Products > Collections > New collection

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/routes.ts apps/dashboard/src/lib/navigation.ts apps/dashboard/src/lib/dashboard-breadcrumbs.ts apps/dashboard/src/lib/dashboard-breadcrumbs.test.ts
git commit -m "feat: add taxonomy dashboard navigation"
```

---

### Task 4: Taxonomy Lists And Tables

**Files:**
- Create: `apps/dashboard/src/features/catalog-taxonomy/taxonomy-table.tsx`
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/categories/page.tsx`
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/collections/page.tsx`

- [ ] **Step 1: Build shared taxonomy table**

Implement a client component with:

- `kind: "categories" | "collections"`;
- shadcn `InputGroup` search;
- reusable `DataTable`;
- row selection;
- bulk `Copy IDs`;
- row actions copy id/handle;
- filtered empty state;
- created/updated date cells;
- category state badges for active/internal flags.

- [ ] **Step 2: Add categories list page**

Fetch `getMerchantProductCategories`, pass pagination metadata, render:

- `PageShell`
- actions: New category link button + `RefreshButton`
- `ListSummary`
- `TaxonomyTable`
- `PaginationControls`
- existing setup/service error states.

- [ ] **Step 3: Add collections list page**

Same pattern using `getMerchantProductCollections`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/catalog-taxonomy/taxonomy-table.tsx apps/dashboard/src/app/admin/'(dashboard)'/products/categories/page.tsx apps/dashboard/src/app/admin/'(dashboard)'/products/collections/page.tsx
git commit -m "feat: add taxonomy list pages"
```

---

### Task 5: Taxonomy Create Forms And Actions

**Files:**
- Create: `apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx`
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/categories/new/page.tsx`
- Create: `apps/dashboard/src/app/admin/product-categories/actions/create/route.ts`
- Create: `apps/dashboard/src/app/admin/(dashboard)/products/collections/new/page.tsx`
- Create: `apps/dashboard/src/app/admin/product-collections/actions/create/route.ts`

- [ ] **Step 1: Build shared taxonomy create form**

Use shadcn form/input primitives and product form handle behavior:

- name/title field;
- handle field;
- lock/unlock;
- regenerate from name/title;
- submit/cancel buttons;
- hidden tenant context through action URL query params, not hidden fields.

- [ ] **Step 2: Add create pages**

Pages:

- `/admin/products/categories/new`
- `/admin/products/collections/new`

Use `PageShell`, `TaxonomyForm`, and tenant-scoped action paths.

- [ ] **Step 3: Add action route handlers**

Routes:

- `/admin/product-categories/actions/create`
- `/admin/product-collections/actions/create`

Behavior:

- parse form data;
- validate required name/title;
- call dashboard client create function;
- redirect back to list with status query and tenant context preserved;
- use non-secret error status codes/copy.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/features/catalog-taxonomy/taxonomy-form.tsx apps/dashboard/src/app/admin/'(dashboard)'/products/categories/new/page.tsx apps/dashboard/src/app/admin/product-categories/actions/create/route.ts apps/dashboard/src/app/admin/'(dashboard)'/products/collections/new/page.tsx apps/dashboard/src/app/admin/product-collections/actions/create/route.ts
git commit -m "feat: add taxonomy create flows"
```

---

### Task 6: Final Verification And Review

**Files:**
- Modify only files from Tasks 1-5 if verification finds issues.

- [ ] **Step 1: Run final checks**

Run:

```bash
pnpm --filter @ecs/platform-api test
pnpm --filter @ecs/dashboard test
pnpm --filter @ecs/platform-api typecheck
pnpm --filter @ecs/dashboard typecheck
pnpm --filter @ecs/dashboard build
git diff --check
git status --short
```

Expected: all pass and working tree is clean.

- [ ] **Step 2: Manual QA checklist**

Report:

- `/admin/products/categories` list loads.
- `/admin/products/collections` list loads.
- Search/filter empty state works.
- Create category flow returns to list.
- Create collection flow returns to list.
- Tenant context is preserved.
- Sidebar collapsed/expanded remains clean.
- Light/dark readability is acceptable.

---

## Self-Review

Spec coverage:

- Category/collection list and create workflows are covered.
- Navigation, breadcrumbs, table controls, row actions, and refresh behavior are covered.
- Edit/delete, stock, variants, and assignment refinements remain out of scope.

Placeholder scan:

- No task depends on unimplemented edit/delete routes.
- The only backend change is merchant-host create route parity for existing tenant-scoped create support.

Type consistency:

- Route names use `productCategories` and `productCollections`.
- Create client result messages distinguish category and collection invalid responses.
