# Catalog Deletion Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the single and bulk catalog deletion gaps for products, collections, and categories across the platform-api and merchant dashboard.

**Architecture:** Extend the platform-api's Medusa service to handle single and bulk deletion requests, expose them via Hono endpoints, add dashboard client helpers to fetch these routes, mount Next.js App Router route handlers, and bind confirmational Alert Dialogs in list/detail pages.

**Tech Stack:** Hono, Next.js App Router, TanStack Query, TanStack Table, Zod, and shadcn UI.

## Global Constraints

- Do not show environment variable names, platform error codes, or local dev recovery details in production merchant UI.
- Do not use native browser controls when a shadcn/ui component exists and fits the need.
- Keep copy production-safe: do not expose raw UUIDs or Medusa internal IDs.
- Invalidate appropriate TanStack queries on success so mutations propagate immediately without page reloads.

---

### Task 1: Add Deletion Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: None
- Produces: `merchantDeleteResultSchema`, `merchantBatchDeleteResultSchema` and their TypeScript types.

- [ ] **Step 1: Add deletion contract Zod schemas**
  
  Open `packages/contracts/src/index.ts` and add the following definitions at the end of the file:
  ```typescript
  export const merchantDeleteResultSchema = z.object({
    id: z.string().min(1),
    deleted: z.boolean(),
  });
  export type MerchantDeleteResult = z.infer<typeof merchantDeleteResultSchema>;

  export const merchantBatchDeleteResultSchema = z.object({
    ids: z.array(z.string().min(1)),
    deleted: z.boolean(),
  });
  export type MerchantBatchDeleteResult = z.infer<typeof merchantBatchDeleteResultSchema>;
  ```

- [ ] **Step 2: Run typecheck to verify build succeeds**
  
  Run: `pnpm --filter @ecs/contracts build`
  Expected: Command completes successfully.

- [ ] **Step 3: Commit**
  
  ```bash
  git add packages/contracts/src/index.ts
  git commit -m "feat(contracts): add deletion schemas and types"
  ```

---

### Task 2: Implement Platform API Medusa Commerce Service Methods

**Files:**
- Modify: `apps/platform-api/src/commerce/product-service.ts`
- Test: `apps/platform-api/src/commerce/product-service.test.ts`

**Interfaces:**
- Consumes: Deletion schemas/types from `@ecs/contracts`
- Produces: Deletion service methods for single and batch catalog deletions.

- [ ] **Step 1: Write failing unit tests for single and batch deletions**

  Open `apps/platform-api/src/commerce/product-service.test.ts` and append tests verifying delete calls:
  ```typescript
  // under describe("createMedusaProductService")
  describe("delete merchant catalog resources", () => {
    it("deletes a single product", async () => {
      // Mock Medusa DELETE /admin/products/:id success
    });
    it("batch deletes products", async () => {
      // Mock Medusa POST /admin/products/batch success
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  
  Run: `pnpm --filter @ecs/platform-api test`
  Expected: FAIL with missing methods on product service.

- [ ] **Step 3: Implement single and batch deletion functions**

  Open `apps/platform-api/src/commerce/product-service.ts` and add methods:
  ```typescript
  // inside createMedusaProductService return block:
  deleteMerchantProduct: async (input: { productId: string; salesChannelId: string }) => {
    const response = await requestMedusa(fetcher, new URL(`/admin/products/${input.productId}`, normalizeBaseUrl(options.medusaInternalUrl)), {
      headers: getAdminHeaders(options.adminApiToken),
      method: "DELETE"
    });
    return parseDeleteResponse(response);
  },
  deleteMerchantProductsBatch: async (input: { productIds: string[]; salesChannelId: string }) => {
    const response = await requestMedusa(fetcher, new URL(`/admin/products/batch`, normalizeBaseUrl(options.medusaInternalUrl)), {
      body: JSON.stringify({ delete: input.productIds }),
      headers: getAdminHeaders(options.adminApiToken),
      method: "POST"
    });
    return parseBatchDeleteResponse(response);
  }
  // Implement similar functions for categories and collections
  ```

- [ ] **Step 4: Run unit tests to verify they pass**
  
  Run: `pnpm --filter @ecs/platform-api test`
  Expected: PASS

- [ ] **Step 5: Commit**
  
  ```bash
  git add apps/platform-api/src/commerce/product-service.ts apps/platform-api/src/commerce/product-service.test.ts
  git commit -m "feat(platform-api): implement product and taxonomy delete service methods"
  ```

---

### Task 3: Expose Platform API Route Handlers

**Files:**
- Modify: `apps/platform-api/src/app.ts`
- Modify: `apps/platform-api/src/routes/merchant-routes.ts`
- Modify: `apps/platform-api/src/routes/platform-routes.ts`

**Interfaces:**
- Consumes: Product service deletion methods.
- Produces: API HTTP Endpoints:
  - `DELETE /platform/merchant/products/:productId`
  - `POST /platform/merchant/products/batch-delete`
  - (and categories/collections counterparts).

- [ ] **Step 1: Register signatures in options**

  Open `apps/platform-api/src/app.ts` and add method signatures to `PlatformAppOptions`:
  ```typescript
  deleteMerchantProduct?: (input: { productId: string; salesChannelId: string }) => Promise<MerchantProductWriteResult>;
  deleteMerchantProductsBatch?: (input: { productIds: string[]; salesChannelId: string }) => Promise<MerchantBatchDeleteResult>;
  // Category and Collection definitions as well...
  ```

- [ ] **Step 2: Implement route handlers in merchant-routes.ts**

  Open `apps/platform-api/src/routes/merchant-routes.ts` and register:
  ```typescript
  app.delete("/platform/merchant/products/:productId", async (context) => {
     // Authorize merchant and resolve commerce context
     // Call options.deleteMerchantProduct
  });
  app.post("/platform/merchant/products/batch-delete", async (context) => {
     // Authorize, get json body of ids, call batch delete option
  });
  // Map taxonomy routes categories/collections...
  ```

- [ ] **Step 3: Implement route handlers in platform-routes.ts**

  Open `apps/platform-api/src/routes/platform-routes.ts` and replicate tenant-specific variants:
  ```typescript
  app.delete("/platform/tenants/:tenantId/products/:productId", ...);
  app.post("/platform/tenants/:tenantId/products/batch-delete", ...);
  // Replicate taxonomy routes...
  ```

- [ ] **Step 4: Run Platform API typechecks and tests**
  
  Run: `pnpm --filter @ecs/platform-api typecheck && pnpm --filter @ecs/platform-api test`
  Expected: PASS

- [ ] **Step 5: Commit**
  
  ```bash
  git add apps/platform-api/src/app.ts apps/platform-api/src/routes/merchant-routes.ts apps/platform-api/src/routes/platform-routes.ts
  git commit -m "feat(platform-api): register hono single and batch deletion endpoints"
  ```

---

### Task 4: Add Dashboard Client Helpers

**Files:**
- Modify: `apps/dashboard/src/lib/merchant-products.ts`
- Test: `apps/dashboard/src/lib/merchant-products.test.ts`

**Interfaces:**
- Consumes: Platform API deletion routes.
- Produces: Deletion helper client wrappers in `apps/dashboard/src/lib/merchant-products.ts`.

- [ ] **Step 1: Write failing client wrapper tests**

  Open `apps/dashboard/src/lib/merchant-products.test.ts` and add test specs verifying fetch URLs, headers, and responses:
  ```typescript
  describe("deleteMerchantProduct", () => {
     it("performs deletion and handles error responses", async () => { ... });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  
  Run: `pnpm --filter @ecs/dashboard test`
  Expected: FAIL with undefined wrapper functions.

- [ ] **Step 3: Implement client fetch wrappers**

  Open `apps/dashboard/src/lib/merchant-products.ts` and add export functions:
  ```typescript
  export async function deleteMerchantProduct(options: { ... }) {
     // sends DELETE request to Platform API
  }
  export async function deleteMerchantProductsBatch(options: { ... }) {
     // sends POST request containing json body of productIds
  }
  // Replicate for categories and collections
  ```

- [ ] **Step 4: Run tests to verify they pass**
  
  Run: `pnpm --filter @ecs/dashboard test`
  Expected: PASS

- [ ] **Step 5: Commit**
  
  ```bash
  git add apps/dashboard/src/lib/merchant-products.ts apps/dashboard/src/lib/merchant-products.test.ts
  git commit -m "feat(dashboard): implement deletion client helpers"
  ```

---

### Task 5: Create Next.js API Route Handlers in Dashboard

**Files:**
- Create: `apps/dashboard/src/app/admin/products/actions/[productId]/delete/route.ts`
- Create: `apps/dashboard/src/app/admin/products/actions/batch-delete/route.ts`
- Create: `apps/dashboard/src/app/admin/products/categories/actions/[categoryId]/delete/route.ts`
- Create: `apps/dashboard/src/app/admin/products/categories/actions/batch-delete/route.ts`
- Create: `apps/dashboard/src/app/admin/products/collections/actions/[collectionId]/delete/route.ts`
- Create: `apps/dashboard/src/app/admin/products/collections/actions/batch-delete/route.ts`

**Interfaces:**
- Consumes: Dashboard client helpers.
- Produces: Next.js API endpoints returning JSON deletion statuses.

- [ ] **Step 1: Implement single product delete API route**
  
  Create `apps/dashboard/src/app/admin/products/actions/[productId]/delete/route.ts`:
  ```typescript
  import { cookies, headers } from "next/headers";
  import { NextResponse } from "next/server";
  import { deleteMerchantProduct } from "@/lib/merchant-products";

  export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
    const { productId } = await params;
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const result = await deleteMerchantProduct({
      productId,
      cookieHeader: cookieStore.toString(),
      platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
      requestHost: requestHeaders.get("host"),
      tenantId: new URL(request.url).searchParams.get("tenantId"),
    });
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ success: true, id: productId });
  }
  ```

- [ ] **Step 2: Implement batch product delete API route**
  
  Create `apps/dashboard/src/app/admin/products/actions/batch-delete/route.ts` parsing `{ productIds: string[] }`.

- [ ] **Step 3: Replicate routes for categories and collections**
  
  Create single and batch delete routes under `products/categories/actions/...` and `products/collections/actions/...`.

- [ ] **Step 4: Run typecheck and compile**
  
  Run: `pnpm --filter @ecs/dashboard typecheck`
  Expected: PASS

- [ ] **Step 5: Commit**
  
  ```bash
  git add apps/dashboard
  git commit -m "feat(dashboard): expose next.js api delete handlers"
  ```

---

### Task 6: Implement Confirmation UI Actions

**Files:**
- Modify: `apps/dashboard/src/features/products/products-table.tsx`
- Modify: `apps/dashboard/src/features/products/product-detail.tsx`
- Modify: `apps/dashboard/src/features/catalog-taxonomy/product-categories-table.tsx`
- Modify: `apps/dashboard/src/features/catalog-taxonomy/product-collections-table.tsx`

**Interfaces:**
- Consumes: Next.js API delete routes.
- Produces: Destructive menus, delete button in details header, and destructive floating bulk-action selection items with Alert Dialog confirmations.

- [ ] **Step 1: Add row-delete action and bulk-delete action in products-table.tsx**

  Open `apps/dashboard/src/features/products/products-table.tsx` and integrate the `useMutation` hook. Inject `Delete` action in `RowActionsMenu`. In `bulkActions` prop of `DataTable`, add a red destructive `Delete selected` button triggering a confirmational `AlertDialog`.

- [ ] **Step 2: Add delete button on product-detail.tsx**

  Open `apps/dashboard/src/features/products/product-detail.tsx` or its page container. Render a red destructive `Delete product` button next to `Edit product` in the page actions bar, backed by a confirmation `AlertDialog` that redirects on success.

- [ ] **Step 3: Add deletion row and bulk actions to categories and collections**

  Open `product-categories-table.tsx` and `product-collections-table.tsx`. Add destructive delete row action items and bulk-delete confirmations.

- [ ] **Step 4: Run verification tests and build**
  
  Run: `pnpm test && pnpm --filter @ecs/dashboard build`
  Expected: PASS

- [ ] **Step 5: Commit**
  
  ```bash
  git add apps/dashboard/src/features
  git commit -m "feat(dashboard): integrate single and bulk delete UI confirmation flows"
  ```
