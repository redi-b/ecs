# Platform API source layout

Target shape from `dev-docs/post-mvp/00-platform-api-organization-cleanup-plan.md`.

```text
src/
  app.ts                 # Hono app factory (thin)
  index.ts               # process wiring / DI composition
  types/                 # shared domain & option types
  context/               # auth + tenant resolution implementations
    platform-auth.ts
    dashboard-authorization.ts
    tenant-resolver.ts
    domain-tenant-lookup.ts
  routes/                # HTTP surfaces only
    merchant/
    platform/
    storefront/
    webhooks/
  modules/               # domain services & facades
    commerce/            # product-catalog, order-management, checkout
    tenants/             # list, status, commerce context, shop provisioning
    billing/, notifications/, delivery/, domains/, support/
    storefront/, onboarding/, payments/, analytics/
  adapters/              # external systems
    medusa/
      product/
      order/
      commerce-provisioning.ts
    chapa/
  config/                # env + hosts
  test/                  # shared test harness
```

Legacy top-level folders (`auth/`, `tenants/`, `billing/`, …) keep **compatibility re-exports** so older import paths still work.

## Rules

- **Routes** validate request/auth/context and call modules (or injected `PlatformAppOptions`).
- **Modules** own domain behavior and factories used by composition.
- **Adapters** talk to Medusa, Chapa, and other providers.
- **types/** holds `PlatformAppOptions` and merchant/commerce result types.
- Prefer new post-MVP resources under:
  - `routes/merchant/<resource>.ts`
  - `modules/<domain>/…`
  - `adapters/<provider>/…` when external I/O is required
