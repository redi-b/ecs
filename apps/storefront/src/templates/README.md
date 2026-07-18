# Storefront templates

One multi-tenant Astro app (`apps/storefront`) serves all shops. **Templates are folders of presentation components**, not separate deploys.

## Layout

```text
src/
  lib/commerce/          # shared logic (cart, checkout, products) — no UI
  pages/                 # stable routes; load data → resolve template slot
  templates/
    classic/v1/          # default template (complete commerce + home)
    fallback/            # shared UI if a template omits a slot
    registry.ts          # template_key → page components (static only)
  components/            # reusable shell / product card
public/styles/commerce.css  # default design system (CSS variables)
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

## Add a premium template

1. **Package** — `packages/storefront-templates/src/templates/<name>/v1/`  
   - `schema.ts`, `defaults.ts`, `editor.ts` (Puck map for home/chrome only)
2. **Astro UI** — `apps/storefront/src/templates/<name>/v1/`  
   - At least `Home.astro`  
   - Optional: `ProductList`, `Product`, `Cart`, `Checkout`, `OrderConfirm`  
   - Omit a slot to inherit `fallback/*`
3. **Register** — in `registry.ts`:

```ts
"<name>@1": {
  Home: NameV1Home,
  ProductList: NameV1ProductList, // optional
  // ...
},
```

4. **Sync** — run platform template sync so merchants can select `name@1` in settings.
5. **Theme** — set CSS variables (`--sf-primary`, etc.) from published `themeTokens`; reuse `commerce.css` or ship a template-specific stylesheet.

## Design system

Default look lives in `public/styles/commerce.css` (`sf-*` classes). Premium templates may:

- Override variables only (quick brand skin), or  
- Ship new markup/CSS while still calling the same actions and commerce helpers.

Do **not** call Medusa from templates. Use `lib/commerce` and page props only.
