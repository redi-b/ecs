# Catalog Taxonomy Readiness Design

## Objective

Add first-class merchant dashboard management for product collections and categories so operators can organize catalog data before deeper product assignment, variants, and stock workflows.

## Scope

In scope:

- Add dashboard pages for product collections and product categories.
- Reuse the premium `DataTable` foundation from Products and Orders.
- Support current-page search, sorting, row actions, selected-row copy actions, refresh, pagination, and empty/filtered-empty states.
- Support create flows for collections and categories using existing Platform API `POST` endpoints.
- Preserve tenant context in list, create, and navigation paths.
- Add sidebar/command/breadcrumb discoverability under the commerce/catalog area.
- Keep copy production-safe and avoid raw env/admin-token/internal backend wording.

Out of scope:

- Editing collections/categories.
- Deleting collections/categories.
- Hierarchical category tree editing.
- Assigning products to taxonomy from taxonomy pages.
- Product form taxonomy UX refinements beyond preserving existing assignment controls.
- Inventory, variants, and stock.
- Platform API update/delete routes.
- Medusa workflow changes.

## Current System Notes

- Platform API already has tenant-scoped list/create routes:
  - `GET /platform/tenants/:tenantId/product-categories`
  - `POST /platform/tenants/:tenantId/product-categories`
  - `GET /platform/tenants/:tenantId/product-collections`
  - `POST /platform/tenants/:tenantId/product-collections`
- Merchant-host routes currently expose list routes for categories/collections; tenant-scoped create routes exist and should be used when `tenantId` is selected.
- Dashboard product forms already consume categories and collections as assignment options.
- Existing contracts include:
  - `MerchantProductCategory`
  - `MerchantProductCategories`
  - `MerchantProductCollection`
  - `MerchantProductCollections`
- There are no verified dashboard edit/delete routes for taxonomy in the current codebase.

## UX Requirements

### Navigation

- Add product sub-navigation entries:
  - Products
  - Categories
  - Collections
- The sidebar should remain clean when collapsed.
- Command center/search keywords should find categories and collections.
- Breadcrumbs:
  - `/admin/products/categories` -> `Products > Categories`
  - `/admin/products/collections` -> `Products > Collections`

### Collections Page

- Route: `/admin/products/collections`.
- Page title: `Collections`.
- Description: clear operational copy about grouping products.
- Actions:
  - `New collection` opens or links to a create flow.
  - Refresh remains available.
- Table columns:
  - Collection: title and handle.
  - Handle.
  - Created.
  - Updated.
  - Actions.
- Search matches id, title, handle.
- Row actions:
  - Copy collection ID.
  - Copy handle, disabled when missing.
- Bulk action:
  - Copy selected collection IDs.
- Empty state:
  - No base data: `No collections have been created for this merchant yet.`
  - Active search no matches: `No collections match the current search.`

### Categories Page

- Route: `/admin/products/categories`.
- Page title: `Categories`.
- Description: clear operational copy about catalog navigation/grouping.
- Actions:
  - `New category` opens or links to a create flow.
  - Refresh remains available.
- Table columns:
  - Category: name and handle.
  - Handle.
  - Visibility/state: active/internal flags.
  - Parent: parent category id until names are available.
  - Created.
  - Updated.
  - Actions.
- Search matches id, name, handle, parent category id.
- Row actions:
  - Copy category ID.
  - Copy handle, disabled when missing.
- Bulk action:
  - Copy selected category IDs.
- Empty state:
  - No base data: `No categories have been created for this merchant yet.`
  - Active search no matches: `No categories match the current search.`

### Create Flows

- Routes:
  - `/admin/products/collections/new`
  - `/admin/products/categories/new`
- Use shadcn inputs/buttons and the dashboard shell style.
- Handle is auto-generated from title/name while locked.
- Include lock/unlock and regenerate controls consistent with the product form handle pattern.
- On submit, call dashboard route handlers that forward to Platform API.
- On success, redirect back to the corresponding list page with tenant context preserved.
- On failure, show user-facing copy without leaking internal config names.

## Data Requirements

- Dashboard client should expose:
  - `createMerchantProductCollection`
  - `createMerchantProductCategory`
- The existing list fetchers should remain unchanged.
- Create body:
  - Collection: `{ title, handle }`
  - Category: `{ name, handle }`
- Invalid create response should map to:
  - `invalid_product_collection_response`
  - `invalid_product_category_response`
- Missing name/title should be validated client-side before calling Platform API.

## Testing Requirements

- Add pure taxonomy table helper tests:
  - collection search/counts/date formatting
  - category search/counts/date formatting/state labels
- Add dashboard client tests for create collection/category:
  - tenant-scoped URL and cookie forwarding
  - invalid response handling
  - request failure handling
- Add breadcrumb tests for category and collection routes.
- Run:
  - `pnpm --filter @ecs/dashboard test`
  - `pnpm --filter @ecs/dashboard typecheck`
  - `pnpm --filter @ecs/dashboard build`

## Manual QA Checklist

- Sidebar and command center expose Categories and Collections.
- `/admin/products/categories` loads and table controls work.
- `/admin/products/collections` loads and table controls work.
- Create category with name only generates a handle and returns to list.
- Create collection with title only generates a handle and returns to list.
- Copy actions do not crash when clipboard is unavailable.
- Filtered empty states are distinct from base empty states.
- Tenant query parameter is preserved.
- Light and dark themes are readable.

## Next Phases

1. Taxonomy edit/delete after backend routes exist.
2. Product assignment UX refinements linking product rows/details to taxonomy pages.
3. Variants and stock visibility/editing.
