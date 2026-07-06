# Catalog Deletion Gaps Design

## Objective

Close the catalog delete gaps for products, collections, and categories in the merchant dashboard by adding secure single and bulk deletion endpoints in the Platform API, and integrating interactive, non-page-reloading confirmation flows into both table row actions and the floating multi-selection action bar.

## Scope

In scope:

- **Platform API Commerce service upgrades:**
  - Add `deleteMerchantProduct` (sends `DELETE /admin/products/:id`) and `deleteMerchantProductsBatch` (sends `POST /admin/products/batch` with `{ delete: ids }`).
  - Add `deleteMerchantProductCategory` (sends `DELETE /admin/product-categories/:id`) and `deleteMerchantProductCategoriesBatch` (sends parallel deletions or runs workflow step).
  - Add `deleteMerchantProductCollection` (sends `DELETE /admin/collections/:id`) and `deleteMerchantProductCollectionsBatch` (sends parallel deletions).
- **Platform API Route registration:**
  - Register Hono `DELETE` routes for single deletes:
    - `DELETE /platform/merchant/products/:productId`
    - `DELETE /platform/merchant/product-categories/:categoryId`
    - `DELETE /platform/merchant/product-collections/:collectionId`
  - Register Hono `POST` routes for batch deletes:
    - `POST /platform/merchant/products/batch-delete`
    - `POST /platform/merchant/product-categories/batch-delete`
    - `POST /platform/merchant/product-collections/batch-delete`
- **Dashboard Client updates:**
  - Implement single and batch deletion helper wrappers in `apps/dashboard/src/lib/merchant-products.ts`.
- **Dashboard Next.js API Routes:**
  - Add Next.js API route handlers to perform tenant-scoped single and batch deletion requests.
- **Interactive Deletion UI:**
  - Add "Delete" row actions with confirmation `AlertDialog`s in product, category, and collection list tables.
  - Add a "Delete product" button with confirmation `AlertDialog` in the product detail page header.
  - Add a "Delete selected" destructive action inside the floating multi-select action bar in all three tables, wrapping it in a batch-deletion confirmation `AlertDialog`.
  - Ensure all deletion operations update TanStack Query caches and trigger `router.refresh()` dynamically without full-page reloads.

Out of scope:

- **Soft-deletes and undo actions:** Direct database soft-deletes outside of what Medusa's standard deletion endpoints do automatically.

## System Notes & Medusa Deletion Rules

- Medusa v2 supports standard `DELETE` endpoints for products, categories, and collections:
  - Deleting a category automatically unlinks products associated with that category.
  - Deleting a collection unlinks associated products.
  - Deleting a product deletes its variants and options.
- Medusa v2 supports product batch deletion via `POST /admin/products/batch` with request payload `{ delete: string[] }`.
- Categories and collections will be deleted in parallel using `Promise.all` on their respective single-delete routes, returning success once all IDs are processed.
- Hono `DELETE` and `POST` route handlers will enforce the same dashboard authorization requirements as matching `GET` / `POST` endpoints.

## UX Requirements

### Table Row Actions
- Add a "Delete" action at the end of the action array in `RowActionsMenu` for:
  - [products-table.tsx](file:///home/redytron/dev/ecs/apps/dashboard/src/features/products/products-table.tsx)
  - [product-categories-table.tsx](file:///home/redytron/dev/ecs/apps/catalog-taxonomy/product-categories-table.tsx)
  - [product-collections-table.tsx](file:///home/redytron/dev/ecs/apps/catalog-taxonomy/product-collections-table.tsx)
- The Delete item variant will be styled as destructive (red text).

### Detail Page Header Actions
- Add a red destructive `Delete product` button next to the `Edit product` button in the header actions of the product detail page.

### Floating Multi-Select Action Bar (Bulk Delete)
- In the floating selection bar that appears when checking items, replace or add beside `Copy IDs` a red destructive `Delete selected` button displaying the selected count:
  - e.g., `Delete (3)`

### Confirmation Dialogs
- Clicking any delete trigger will open a shadcn `AlertDialog` showing:
  - **Single Deletion Title:** `Delete [product/category/collection]?`
  - **Single Deletion Description:** 
    - For Products: *“This will permanently remove the product and all its variants from your catalog. This action cannot be undone.”*
    - For Categories: *“This will permanently remove the category. Any products assigned to this category will be unassigned, but won’t be deleted.”*
    - For Collections: *“This will permanently remove the collection. Any products assigned to this collection will be unassigned, but won’t be deleted.”*
  - **Bulk Deletion Title:** `Delete selected [products/categories/collections]?`
  - **Bulk Deletion Description:** *“Are you sure you want to permanently delete the [count] selected items? This action is irreversible.”* (Include category/collection unlinking warning where applicable).
  - **Cancel Button:** Closes the dialog.
  - **Confirm Button:** Destructive styled button showing a loading spinner / state (e.g., `Deleting...`) while request is pending.

### Dynamic Feedbacks
- Success: Closes the dialog, shows a Sonner success toast (e.g., `Product deleted.` or `3 products deleted.`), invalidates the query cache, and runs `router.refresh()` to reload lists/redirect parent pages.
- Failure: Keeps the dialog open (or closes it and shows a Sonner toast with a clean, merchant-safe error description).

## Technical Implementation Plan

### 1. Contracts & Types (`packages/contracts/src/index.ts`)
- Define deletion result schemas:
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

### 2. Platform API (`apps/platform-api/src/...`)
- Add methods to `createMedusaProductService`:
  - `deleteMerchantProduct({ productId, salesChannelId })`
  - `deleteMerchantProductsBatch({ productIds, salesChannelId })`
  - `deleteMerchantProductCategory({ categoryId, tenantId })`
  - `deleteMerchantProductCategoriesBatch({ categoryIds, tenantId })`
  - `deleteMerchantProductCollection({ collectionId, tenantId })`
  - `deleteMerchantProductCollectionsBatch({ collectionIds, tenantId })`
- Update `PlatformAppOptions` definitions in `apps/platform-api/src/app.ts`.
- Register the `DELETE` and `POST` handlers in:
  - `apps/platform-api/src/routes/merchant-routes.ts`
  - `apps/platform-api/src/routes/platform-routes.ts`

### 3. Dashboard Client (`apps/dashboard/src/lib/merchant-products.ts`)
- Add client fetch helpers calling the single and batch deletion endpoints:
  - Single deletion helpers:
    - `deleteMerchantProduct({ productId, tenantId, cookieHeader, requestHost })`
    - `deleteMerchantProductCategory({ categoryId, tenantId, cookieHeader, requestHost })`
    - `deleteMerchantProductCollection({ collectionId, tenantId, cookieHeader, requestHost })`
  - Batch deletion helpers:
    - `deleteMerchantProductsBatch({ productIds, tenantId, cookieHeader, requestHost })`
    - `deleteMerchantProductCategoriesBatch({ categoryIds, tenantId, cookieHeader, requestHost })`
    - `deleteMerchantProductCollectionsBatch({ collectionIds, tenantId, cookieHeader, requestHost })`

### 4. Next.js API Route Handlers (`apps/dashboard/src/app/admin/...`)
- Register Next.js POST handlers for single delete:
  - `POST /admin/products/actions/[productId]/delete`
  - `POST /admin/products/categories/actions/[categoryId]/delete`
  - `POST /admin/products/collections/actions/[collectionId]/delete`
- Register Next.js POST handlers for batch delete:
  - `POST /admin/products/actions/batch-delete`
  - `POST /admin/products/categories/actions/batch-delete`
  - `POST /admin/products/collections/actions/batch-delete`
- Route handlers will parse cookies/tenant context and invoke the deletion client helper, returning a JSON response.

### 5. Frontend UI (`apps/dashboard/src/features/...`)
- Integrate confirmation alert dialogs and mutation hooks:
  - Use `useMutation` from `@tanstack/react-query` to hit the Next.js action API routes.
  - Invalidate `["products"]`, `["product-categories"]`, and `["product-collections"]` queries on success.
  - On the product detail page, redirect the user back to the `/admin/products` page on success.

## Verification Plan

### Automated Tests
- Run `pnpm test` to verify existing tests pass.
- Add unit tests in `apps/platform-api/src/commerce/product-service.test.ts` for single and batch product/category/collection deletions.
- Add client helper tests in `apps/dashboard/src/lib/merchant-products.test.ts` to cover error handling and context mapping.

### Manual Verification
- Deploy to local development environment.
- Confirm deleting multiple products via checkboxes and clicking `Delete selected` deletes all selected items cleanly without full page reloads.
- Verify invalid IDs or permission errors show merchant-safe error alerts.
