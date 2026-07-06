# Merchant Order Management Readiness Design

## Objective

Build the first usable merchant order management slice in the dashboard by upgrading the orders list to the same table foundation used by products and adding a real order detail page. This phase is intentionally read-first: it gives operators a reliable way to find, inspect, and navigate orders before we add fulfillment, refund, or stock mutation workflows.

## Scope

In scope:

- Reuse the dashboard `DataTable` foundation for orders.
- Add order-specific table state helpers for search, status filtering, totals, dates, and selected counts.
- Add a premium order table with search, shadcn status filters, sortable columns, row selection, row actions, refresh support, and links to detail pages.
- Add tenant-aware `/admin/orders/[orderId]` detail route.
- Extend the dashboard order client to fetch a single order through the existing Platform API order detail endpoints.
- Show customer, delivery, shipping address, payment, fulfillment, line-item-ready status summaries where the current contract supports them.
- Keep order action buttons honest: expose disabled or read-only action slots only when the data/action contract is not ready for production UX.
- Preserve existing setup/service error handling so development-only backend configuration details do not leak into production-oriented copy.

Out of scope for this phase:

- Refunds.
- Capturing payments.
- Fulfillment creation/delivery mutations in the dashboard.
- Order editing.
- Customer management pages.
- Product/category/collection/stock management.
- Server-side search/filter/sort against Medusa.

## Current System Notes

- `apps/dashboard/src/app/admin/(dashboard)/orders/page.tsx` already lists orders with pagination and a refresh button.
- `apps/dashboard/src/features/orders/orders-table.tsx` is currently a basic table consumer and should be upgraded to match products table behavior.
- `apps/dashboard/src/lib/merchant-orders.ts` only fetches order lists; it needs a detail fetcher.
- Platform API already exposes merchant and tenant order detail routes:
  - `/platform/merchant/orders/:orderId`
  - `/platform/tenants/:tenantId/orders/:orderId`
- Platform API already has order mutation endpoints, but this phase will not wire dashboard mutations because the UI/confirmation/error model needs its own deliberate design.
- `MerchantOrder` currently includes order identity, display id, email, status, payment status, fulfillment status, currency, total, delivery choice/customer fields, fulfillments, shipping address, created/updated timestamps.

## UX Requirements

### Orders List

- The list should feel like the products table foundation, not a separate design language.
- Search filters the current server page without a page reload.
- Search should match:
  - order id
  - display id
  - customer email
  - delivery customer name
  - delivery customer phone
  - payment status
  - fulfillment status
  - order status
- Filters should use shadcn `Select`, not native selects.
- The first filter should be a combined lifecycle filter:
  - `all`
  - `open`
  - `completed`
  - `canceled`
  - `needs fulfillment`
  - `fulfilled`
  - `payment pending`
  - `paid`
- Sorting should support at least:
  - order number/id
  - created date
  - total
  - payment status
  - fulfillment status
- Row actions should include:
  - View details
  - Copy order ID
  - Copy customer email, disabled when missing
- Row selection should enable a floating selected bar.
- Bulk actions in this phase should only include safe utility actions:
  - Copy selected order IDs
- Empty state behavior:
  - No base data: "No orders have been placed for this merchant yet."
  - Active filter with zero matches: "No orders match the current search or filters."
- The table summary should distinguish current server page from total count.
- Refresh remains page-level and reloads the current route without a full manual browser reload.

### Order Detail

- Route: `/admin/orders/[orderId]`.
- Breadcrumb should be `Orders > #<displayId>` when display id is available; otherwise `Orders > Order details`.
- The detail page should use existing shell patterns and avoid a new visual language.
- Header should include:
  - order number or id
  - created date
  - high-level status badges
  - refresh button
- Sections:
  - Customer: email, delivery customer name, phone.
  - Delivery: choice, landmark, notes.
  - Shipping address: formatted address from the current contract.
  - Payment and fulfillment: payment status, fulfillment status, order status.
  - Fulfillments: count and latest shipped/delivered/canceled signals from current contract.
  - Totals: total and currency using the same price-format rule as the existing codebase.
- If the current contract does not include line items, the detail page must not invent item rows. It should show a restrained note that item-level detail will appear when the order contract includes items.
- Product links inside order detail are deferred until line items are available in the contract.

## Data And Error Handling

- Dashboard fetchers must forward session cookies and tenant context exactly like the current orders list fetcher.
- Detail fetcher should return a discriminated result type:
  - `ok: true` with `order`
  - `ok: false` with `status` and `message`
- Invalid detail responses should map to `invalid_order_response`.
- `order_not_found` should render a user-facing not-found state, not a destructive backend error.
- Existing setup/service mapping should be reused where possible.
- Production-facing copy should stay operational and non-secret. It should not mention admin tokens, internal env names, or raw backend stack details.

## Implementation Boundaries

- Prefer dashboard-only changes unless the current contract blocks rendering the detail page.
- Do not modify Medusa backend workflows in this phase.
- Do not modify Platform API order mutation behavior in this phase.
- Do not add a new table system; extend the reusable dashboard `DataTable` only when the improvement helps orders and products.
- Keep helper logic testable outside React:
  - search text
  - lifecycle filter normalization
  - count derivation
  - money/date formatting where practical

## Testing Requirements

- Add unit tests for order table state helpers:
  - search matching
  - lifecycle filter behavior
  - active filter detection
  - formatted identity fallback
- Add dashboard client tests for single-order fetch:
  - tenant URL and headers
  - invalid response handling
  - request failure handling
- Add breadcrumb tests for `/admin/orders/[orderId]` and dynamic label overrides.
- Run:
  - `pnpm --filter @ecs/dashboard test`
  - `pnpm --filter @ecs/dashboard typecheck`
  - `pnpm --filter @ecs/dashboard build`

## Manual QA Checklist

- `/admin/orders` loads with the upgraded table.
- Search filters current visible orders without page reload.
- Lifecycle filter works and shows filtered empty state when nothing matches.
- Sort headers reorder visible rows.
- Row action menu opens and copy actions do not crash when clipboard is unavailable.
- Selecting rows shows a floating selected bar and does not cover pagination.
- Detail links preserve selected tenant context.
- `/admin/orders/[orderId]` renders a real order detail page.
- Missing/not-found orders show a clear state.
- Light and dark themes keep table and detail surfaces readable.

## Sequencing After This Phase

1. Catalog taxonomy management: collections and categories list/create/edit.
2. Product form taxonomy assignment refinements and links from product rows/detail to category/collection pages.
3. Inventory and variants management, including stock visibility and later stock mutations.
4. Order fulfillment actions after the order detail UX and inventory model are clear.
