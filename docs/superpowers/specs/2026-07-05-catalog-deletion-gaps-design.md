# Catalog Deletion Gaps Design

## Objective

Close the catalog delete gaps for products, collections, and categories in the merchant dashboard by adding secure deletion endpoints in the Platform API and integrating interactive, non-page-reloading confirmation flows into the dashboard tables and detail screens.

## Scope

In scope:

- **Platform API Commerce service upgrades:**
  - Add `deleteMerchantProduct` to Medusa product service (sends `DELETE /admin/products/:id`).
  - Add `deleteMerchantProductCategory` to Medusa product service (sends `DELETE /admin/product-categories/:id`).
  - Add `deleteMerchantProductCollection` to Medusa product service (sends `DELETE /admin/collections/:id`).
- **Platform API Route registration:**
  - Register Hono `DELETE` routes on both merchant-host and tenant-scoped platform routing tables:
    - `DELETE /platform/merchant/products/:productId`
    - `DELETE /platform/merchant/product-categories/:categoryId`
    - `DELETE /platform/merchant/product-collections/:collectionId`
    - `DELETE /platform/tenants/:tenantId/products/:productId`
    - `DELETE /platform/tenants/:tenantId/product-categories/:categoryId`
    - `DELETE /platform/tenants/:tenantId/product-collections/:collectionId`
- **Dashboard Client updates:**
  - Implement deletion helper wrappers in `apps/dashboard/src/lib/merchant-products.ts`.
- **Dashboard Next.js API Routes:**
  - Add Next.js API route handlers to perform tenant-scoped deletion requests using the dashboard client.
- **Interactive Deletion UI:**
  - Add "Delete" row actions with confirmation `AlertDialog`s in product, category, and collection list tables.
  - Add a "Delete product" button with confirmation `AlertDialog` in the product detail page header.
  - Ensure all deletion operations update TanStack Query caches and trigger `router.refresh()` dynamically without full-page reloads.

Out of scope:

- **Bulk Deletion:** Bulk selection delete actions are deferred to post-MVP to prevent accidental bulk data loss.
- **Soft-deletes and undo actions:** Direct database soft-deletes outside of what Medusa's standard `DELETE` endpoints do automatically.

## System Notes & Medusa Deletion Rules

- Medusa v2 supports standard `DELETE` endpoints for products, categories, and collections:
  - Deleting a category automatically unlinks products associated with that category.
  - Deleting a collection unlinks associated products.
  - Deleting a product deletes its variants and options.
- Existing platform-api and dashboard route handlers pass tenant context via headers or query strings (`tenantId`).
- Hono `DELETE` route handlers will enforce the same dashboard authorization requirements as matching `GET` / `POST` endpoints.

## UX Requirements

### Table Row Actions
- Add a "Delete" action at the end of the action array in `RowActionsMenu` for:
  - [products-table.tsx](file:///home/redytron/dev/ecs/apps/dashboard/src/features/products/products-table.tsx)
  - [product-categories-table.tsx](file:///home/redytron/dev/ecs/apps/catalog-taxonomy/product-categories-table.tsx)
  - [product-collections-table.tsx](file:///home/redytron/dev/ecs/apps/catalog-taxonomy/product-collections-table.tsx)
- The Delete item variant will be styled as destructive (red text).

### Detail Page Header Actions
- Add a red destructive `Delete product` button next to the `Edit product` button in the header actions of the product detail page.

### Confirmation Dialogs
- Clicking any delete trigger will open a shadcn `AlertDialog` showing:
  - **Title:** e.g., `Delete product?` / `Delete category?` / `Delete collection?`
  - **Description:** 
    - For Products: *“This will permanently remove the product and all its variants from your catalog. This action cannot be undone.”*
    - For Categories: *“This will permanently remove the category. Any products assigned to this category will be unassigned, but won’t be deleted.”*
    - For Collections: *“This will permanently remove the collection. Any products assigned to this collection will be unassigned, but won’t be deleted.”*
  - **Cancel Button:** Closes the dialog.
  - **Confirm Button:** Destructive styled button showing a loading spinner / state (e.g., `Deleting...`) while request is pending.

### Dynamic Feedbacks
- Success: Closes the dialog, shows a Sonner success toast (e.g., `Product deleted.`), invalidates the query cache, and runs `router.refresh()` to reload list/redirect parent pages.
- Failure: Keeps the dialog open (or closes it and shows a Sonner toast with a merchant-safe error description).

## Technical Implementation Plan

### 1. Contracts & Types (`packages/contracts/src/index.ts`)
- Define deletion result schemas:
  ```typescript
  export const merchantDeleteResultSchema = z.object({
    id: z.string().min(1),
    deleted: z.boolean(),
  });
  export type MerchantDeleteResult = z.infer<typeof merchantDeleteResultSchema>;
  ```

### 2. Platform API (`apps/platform-api/src/...`)
- Add methods to `createMedusaProductService`:
  - `deleteMerchantProduct({ productId, salesChannelId })`
  - `deleteMerchantProductCategory({ categoryId, tenantId })`
  - `deleteMerchantProductCollection({ collectionId, tenantId })`
- Update `PlatformAppOptions` definitions in `apps/platform-api/src/app.ts`.
- Register the `DELETE` handlers in:
  - `apps/platform-api/src/routes/merchant-routes.ts`
  - `apps/platform-api/src/routes/platform-routes.ts`

### 3. Dashboard Client (`apps/dashboard/src/lib/merchant-products.ts`)
- Add client fetch helpers calling the deletion endpoints:
  - `deleteMerchantProduct({ productId, tenantId, cookieHeader, requestHost })`
  - `deleteMerchantProductCategory({ categoryId, tenantId, cookieHeader, requestHost })`
  - `deleteMerchantProductCollection({ collectionId, tenantId, cookieHeader, requestHost })`

### 4. Next.js API Route Handlers (`apps/dashboard/src/app/admin/...`)
- Register Next.js POST handlers:
  - `POST /admin/products/actions/[productId]/delete`
  - `POST /admin/products/categories/actions/[categoryId]/delete`
  - `POST /admin/products/collections/actions/[collectionId]/delete`
- These routes will parse cookies/tenant context and invoke the deletion client helper, returning a JSON response.

### 5. Frontend UI (`apps/dashboard/src/features/...`)
- Integrate confirmation alert dialogs and mutation hooks:
  - Use `useMutation` from `@tanstack/react-query` to hit the Next.js action API routes.
  - Invalidate `["products"]`, `["product-categories"]`, and `["product-collections"]` queries on success.
  - On the product detail page, redirect the user back to the `/admin/products` page on success.

## Verification Plan

### Automated Tests
- Run `pnpm test` to verify existing tests pass.
- Add unit tests in `apps/platform-api/src/commerce/product-service.test.ts` for product, category, and collection deletions.
- Add client helper tests in `apps/dashboard/src/lib/merchant-products.test.ts` to cover error handling and context mapping.

### Manual Verification
- Deploy to local development environment.
- Confirm deleting a product from the products table list unrenders it without full page reload.
- Confirm deleting a product from its details page redirects back to `/admin/products` and shows a success toast.
- Confirm deleting a category/collection updates the table lists dynamically.
- Verify invalid IDs or permission errors show merchant-safe error alerts.
