# Merchant Products Table Foundation Design

## Goal

Upgrade the merchant product list into a premium, reusable data-table foundation that can carry product management now and order management next.

## Scope

This slice includes:

- A reusable dashboard data table built on TanStack Table beyond core row rendering.
- Product list search, sorting, filtering, pagination summary, row actions, and row selection.
- A thumbnail/media cell with graceful fallback for products without thumbnails or images.
- A selected-rows bulk action surface that can be reused for orders.
- HeroUI-inspired visual polish while staying inside the current shadcn/Tailwind design system.
- Tests for table state helpers and product table behavior where practical.

This slice does not include:

- Product category management screens.
- Product collection management screens.
- Variant creation/editing.
- Stock adjustment workflows.
- Order management pages.
- Server-side search/filter/sort changes unless local table behavior exposes a hard limitation.
- Destructive bulk product mutations.

## Sequencing

This table foundation should happen before order management. Orders need the same foundation: search, sorting, row actions, selectable rows, pagination controls, empty states, and responsive table behavior. Building orders first would duplicate weak table patterns.

After this slice, the recommended order is:

1. Categories and collections management, because those directly improve product organization and product form usefulness.
2. Basic order management, using the upgraded table foundation.
3. Variants and stock management, because they are deeper product workflows and should not be squeezed into the table foundation slice.

Stock can move earlier only if order fulfillment work needs inventory edits immediately.

## Architecture

The table foundation stays dashboard-local. It should not change the Platform API contract unless the current list endpoint prevents a specific interaction from working acceptably.

The upgraded table should be split into focused units:

- `DataTable`: reusable shell that owns TanStack Table state wiring, rendering, and common controls.
- Product column definitions: product-specific cells, filters, and row actions.
- Product media cell: thumbnail/image fallback and compact media signal.
- Bulk selection bar: reusable selected-row action surface.
- Row actions menu: reusable dropdown composition, with product-specific actions passed in.

The first implementation can use client-side search, sort, filter, and selection over the current page of server-paginated results. That matches the current backend shape and keeps this slice bounded. Server-side search and filtering can be added later when product volume makes page-local controls insufficient.

## Table Behavior

Products table should support:

- Global search over title, handle, status, and id for the currently loaded page.
- Sortable headers for product title, status, updated date, variant count, media count, and price when values are present.
- Status filter for published, draft, and unknown.
- Row selection with per-row checkboxes and a header select-all checkbox for visible rows.
- Selection summary such as "3 selected".
- Clear selection action.
- Row actions menu with view details, edit product, copy product ID, and copy handle when available.
- Empty state for no products.
- Filtered empty state for no matching rows.
- Current-page result summary that makes filtered counts clear.

Initial bulk action support should be intentionally conservative:

- Clear selection.
- Copy selected product IDs.
- Open selected count context.

Bulk publish, archive, or delete should not ship until the backend and confirmation UX are designed. The UI can be structured to add those later without exposing dead or unsafe actions.

## Visual Design

The target is a premium dark/light dashboard table inspired by HeroUI while still using shadcn primitives.

Visual rules:

- Use a rounded outer container with a subtle border and card background.
- Keep row dividers low-contrast.
- Use comfortable row height and padding.
- Use compact rounded badges for statuses.
- Use a soft thumbnail square/circle hybrid that feels intentional, not like a broken image.
- Use row hover and selected-row states that are visible but restrained.
- Use smooth transitions for row hover, selected state, dropdowns, and the floating bulk bar.
- Keep table controls aligned in a dense toolbar, not scattered across the page.
- Avoid one-off hardcoded colors; use semantic tokens and existing blue accent tokens.

The thumbnail fallback should show a small branded/product placeholder using initials or a neutral image icon, with enough contrast in both themes.

## Product List Layout

The product page should render:

1. Page shell actions: refresh and create product.
2. Compact list metrics above the table: total products, current page range, filtered match count when filters are active.
3. Table toolbar:
   - search input,
   - status filter,
   - optional view/reset controls,
   - selected-row state when relevant.
4. Product table:
   - selection,
   - product with thumbnail/title/handle,
   - status,
   - price,
   - variants,
   - media,
   - updated date,
   - row actions.
5. Existing server pagination below the table.
6. Floating selected-row bar when one or more visible rows are selected.

## Reuse For Orders

The reusable table API should let Orders later provide:

- order-specific columns,
- searchable fields,
- filter controls,
- row actions,
- selected-row bulk actions,
- status badges,
- current page data from the existing order endpoint.

The implementation should avoid product-specific assumptions in `DataTable`. Product-specific behavior belongs in product table files.

## Data Flow

Product page data flow stays unchanged:

1. Dashboard page resolves host, cookies, tenant context, page, and page size.
2. Dashboard requests products from Platform API.
3. Platform API returns the current server page and total count.
4. Client table applies search, sort, filter, and selection to the loaded page.
5. Pagination controls request a new server page through URL state.

This makes the UI useful immediately without expanding backend query semantics prematurely.

## Error Handling

Existing setup and service states remain page-level. The table should only render when product data loaded successfully.

Table-level empty states:

- No products: action-oriented copy with create-product affordance already available in page actions.
- No matching filters: explain that filters/search can be cleared.

Row actions should degrade cleanly:

- Copy handle action is hidden or disabled when no handle exists.
- Edit/view actions preserve selected tenant context.
- Clipboard actions should fail silently or show a non-destructive toast when toast infrastructure is available.

## Accessibility

The table must keep native table semantics through shadcn table primitives.

Controls need:

- Accessible labels for selection checkboxes.
- Sort buttons with clear labels.
- Row action menu labels.
- Keyboard-accessible dropdowns.
- Focus-visible states from existing shadcn components.

The floating selection bar must not cover essential controls on small screens; it should sit above page content with enough spacing or collapse into a compact bottom bar.

## Testing

Dashboard tests should cover:

- Product table search filters current-page rows.
- Status filter narrows rows.
- Sorting changes visible row order.
- Selection count updates when selecting rows and clearing selection.
- Product row action hrefs preserve selected tenant context.
- Thumbnail fallback renders when no thumbnail exists.

Typecheck and build remain required:

- `pnpm --filter @ecs/dashboard test`
- `pnpm --filter @ecs/dashboard typecheck`
- `pnpm --filter @ecs/dashboard build`

Platform API tests are not required for this slice unless backend query behavior changes.

## Success Criteria

- Products table visibly feels like a polished dashboard table, not a placeholder.
- A merchant can search, sort, filter, select, and act on rows without page reloads.
- Products without thumbnails still look intentional.
- The table foundation can be reused by Orders without copying product-specific code.
- Existing product pagination, refresh, create, detail, and edit flows keep working.
- No unsafe bulk mutation is exposed before backend and confirmation flows are designed.
