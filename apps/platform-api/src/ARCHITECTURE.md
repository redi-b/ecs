# Platform API source layout

Target shape from `dev-docs/post-mvp/00-platform-api-organization-cleanup-plan.md`.

```text
src/
  app.ts                 # Hono app factory (thin)
  index.ts               # process wiring / DI composition
  types/                 # shared domain & option types
  context/               # auth + tenant resolution entrypoints
  routes/                # HTTP surfaces only
    merchant/
    platform/
    storefront/
    webhooks/
  modules/               # domain facades used by composition & routes
    commerce/
    billing/
    notifications/
    tenants/
    storefront/
    ...
  adapters/              # external systems
    medusa/
      product/
      order/
      commerce-provisioning.ts
    chapa/
  modules/
    billing/service.ts, notifications/service.ts, delivery/, domains/,
    support/, storefront/template-service.ts, tenants/, analytics/, …
  auth|tenancy|provisioning|payments  # remaining legacy paths with re-exports
```

## Rules

- **Routes** validate request/auth/context and call modules (or injected options).
- **Modules** expose domain-shaped factories (`createProductCatalog`, `createOrderManagement`, …) and own domain services where they do not need an external adapter.
- **Adapters** talk to Medusa, Chapa, and other providers.
- **types/** is the home for `PlatformAppOptions` and merchant/commerce result types.
- Prefer adding new post-MVP resources under `routes/merchant/<resource>.ts` + `modules/` + `adapters/` as needed.
- Old paths (`billing/billing-service.ts`, `commerce/product-service.ts`, …) re-export for compatibility.
