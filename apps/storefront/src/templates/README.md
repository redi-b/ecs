# Storefront templates

One multi-tenant Astro app (`apps/storefront`) serves all shops. **Templates are folders of presentation components**, not separate deploys.

## Layout

```text
src/
  lib/commerce/          # shared logic (cart, checkout, products) — no UI
  pages/                 # stable routes; load data → resolve template slot
  templates/
    luvia/v1/            # complete versioned storefront adapter
    fallback/            # shared UI if a template omits a slot
    registry.ts          # template_key → page components (static only)
public/styles/commerce.css # legacy shell styles used by fallbacks
```

## Route contract (do not change per template)

| Path | Slot |
|------|------|
| `/` | `Home` (required) |
| `/products` | `ProductList` |
| `/products/:handle` | `Product` |
| `/cart` | `Cart` |
| `/checkout` | `Checkout` |
| `/order/:id` | `OrderConfirm` |
| `/actions/*` | shared mutations (not templated) |

Forms always post to `/actions/cart/*` and `/actions/checkout/*` with the same field names.

## luvia@1

Full commerce surface inspired by Medusa starter patterns:

- Collections strip, PLP filters (search / collection / category / sort), active filter chips
- Multi-option variant chips with stock and price updates
- Related products, breadcrumbs, product JSON-LD
- Header search, mobile nav, sticky mobile add-to-cart
- Cart line images, checkout steps, trust copy

## Add a premium template later

1. Package schema/defaults/editor under `packages/storefront-templates`
2. Astro UI under `apps/storefront/src/templates/<name>/v1/`
3. Register `"name@1"` in `registry.ts`
4. Add its editor manifest, then sync templates to the platform database

Do **not** call Medusa from templates. Use `lib/commerce` and page props only.
