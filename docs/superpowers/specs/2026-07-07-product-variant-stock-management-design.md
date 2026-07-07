# Product Variant And Stock Management Design

## Context

The merchant dashboard has enough catalog functionality for an MVP, but product creation, variant handling, and inventory management need to move closer to Medusa's product model.

The current dashboard product form supports one option group through `optionTitle` and comma/newline `optionValues`, and places that work near pricing. The platform API already exposes products with variants, option values, prices, and inventory item IDs. Stock management exists, but the public dashboard flow treats stock as product-level stock and current backend tests intentionally reject stock reads and updates for multi-variant products.

The next version should make variants and inventory first-class: options generate sellable variants, variants carry price/SKU/stock decisions, and product detail editing uses focused sections instead of reopening the create composer.

## Goals

- Support multiple product options during product creation.
- Generate the full Medusa variant matrix before product creation.
- Let merchants apply variant price, SKU, and stock defaults, then edit exceptions.
- Manage stock against the correct Medusa inventory item and tenant stock location.
- Replace product-level stock assumptions with variant-aware stock operations.
- Move product editing toward Medusa-style detail sections.
- Add practical table filters for products and orders.
- Move category and collection creation into composer-style modals.

## Non-Goals

- Building a custom inventory system outside Medusa.
- Replacing Medusa inventory items, reservations, or stock locations with platform tables.
- Implementing all destructive post-creation option structure edits in the first pass.
- Moving all product/order filters server-side immediately.
- Redesigning unrelated dashboard navigation or storefront behavior.

## Product Creation

The product composer should become a four-step flow:

1. Details: title, handle, description, images, thumbnail, and status.
2. Organization: collection, categories, and product options.
3. Variants: generated variant matrix, defaults, and row overrides.
4. Review: summary, warnings, and submit.

Product options belong in the organization/setup part of the composer, not in the pricing tab. Pricing should become variant-aware because the sellable Medusa entity is the variant.

The options UI should support multiple option groups, each with a title and multiple values. Example:

- Size: S, M, L
- Color: Black, White

The variants step should auto-generate the cartesian product of option values. Merchants should not have to fill each row manually by default. Instead, the UI should provide:

- base price and currency applied to all generated variants
- base initial stocked quantity applied to all generated variants
- optional SKU pattern or prefix
- per-variant row overrides for SKU, price, and stock

If option changes would remove variants with row overrides, the UI should warn before discarding those edits. For MVP, this warning only needs to exist inside the create composer before submit.

## Backend Contract

Product create input should accept both product-level fields and variant-level fields.

The product-level payload should continue supporting:

- title
- handle
- description
- status
- thumbnail and images
- collection ID
- category IDs
- options

The variant payload should include:

- option values, keyed or otherwise mapped to option title
- SKU
- price amount
- currency code
- initial stocked quantity

The platform API should create the Medusa product, options, variants, prices, inventory items, and initial stock levels through Medusa APIs. Medusa remains the source of truth.

Product responses should continue exposing variants, and variants should include:

- variant ID
- inventory item ID when available
- title or display label
- SKU
- option values
- prices
- stock summary when stock data is requested or included

## Variant Stock

Stock management should become explicitly variant-aware.

The existing compatibility route can remain for single-variant products:

- `GET /platform/merchant/products/:productId/stock`
- `POST /platform/merchant/products/:productId/stock`

Those routes should only succeed when there is exactly one stock-managed variant. Multi-variant products should use new variant-specific routes:

- `GET /platform/merchant/products/:productId/variants/:variantId/stock`
- `POST /platform/merchant/products/:productId/variants/:variantId/stock`

The backend must validate:

- the product belongs to the tenant's Medusa sales channel
- the variant belongs to the product
- the variant has an inventory item
- the stock location is the tenant's configured Medusa stock location
- stocked quantity is a non-negative whole number

Implementation should reuse the existing product-service inventory helpers where possible. Current tests that assert multi-variant stock reads and updates fail should be replaced with positive coverage for variant-specific stock operations.

## Product Detail Editing

Product detail editing should move away from reusing the full create composer. The detail page should expose focused sections with their own edit actions:

- General: title, handle, description, status, thumbnail/images.
- Organization: collection and categories.
- Options: option groups and values.
- Variants: option values, SKU, price, and stock state.
- Inventory: per-variant stock controls and tenant stock location summary.
- Metadata: created/updated timestamps and other read-only system fields.

First implementation pass should support:

- editing general product fields
- editing organization fields
- editing variant SKU and price
- editing per-variant stock

Structural option edits after creation are higher risk because they can add or remove variants. The first pass should defer destructive option structure edits. Adding option values and generated variants can be added later once creation and variant stock flows are stable.

## Table Filters

Product and order tables should gain filters that match their resource model.

Product filters:

- status: draft, published, unknown
- collection
- category
- stock state: in stock, low stock, out of stock, unmanaged
- variant count: single variant, multi-variant
- price range when variant prices are available

Order filters:

- lifecycle/status
- payment status
- fulfillment status
- date range
- total range
- customer search

For MVP, filters can remain client-side if the dashboard is still loading bounded merchant lists. The same filter vocabulary should be suitable for later platform API query params when list sizes require server-side filtering.

## Taxonomy Creation

Category and collection creation should move into composer-style modals. Tables remain the primary landing pages.

Category modal fields:

- name
- handle
- parent category
- active/internal flags if those fields remain exposed

Collection modal fields:

- title
- handle

After creation, the modal should close and the relevant table data should refresh.

## Execution Order

1. Update backend contracts and tests for variant-aware product creation and variant stock.
2. Build the product create option builder and variant matrix UI.
3. Replace product detail edit composer usage with focused detail section edits.
4. Add product and order table filters.
5. Move category and collection creation to composer-style modals.

This order keeps stock and variants as the foundation. Product detail editing, filters, and taxonomy modal work can then consume reliable variant and inventory data instead of compensating for product-level stock assumptions.

## Testing

Backend tests should cover:

- creating a product with multiple option groups and generated variants
- rejecting invalid variant payloads
- reading stock for a specific variant
- updating stock for a specific variant
- rejecting stock operations for variants outside the product
- rejecting stock operations outside the tenant sales channel

Dashboard tests should cover:

- generating a variant matrix from multiple option groups
- preserving per-row overrides when non-destructive option changes occur
- warning before destructive option changes discard overrides
- submitting variant defaults and overrides in the expected payload shape
- filtering products by stock state and variant count
- filtering orders by payment, fulfillment, date, and total constraints

## Open Implementation Decisions

- Exact SKU pattern syntax for generated variant rows.
- Whether stock summaries are included in product list responses immediately or loaded on product detail only.
- Whether price range filtering remains client-side only for the next release.
- Whether category and collection edit flows should also move into modals in the same pass as creation.
