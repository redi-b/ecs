# Platform API source layout

The source tree is organized by runtime responsibility and domain boundary.

```text
src/
  app.ts                 # Hono app factory (thin)
  index.ts               # HTTP executable composition root
  worker.ts              # background worker composition + lifecycle
  bootstrap/             # runtime-specific dependency bundles
  scripts/               # one-shot maintenance executables
  seeds/                 # demo and reference-data seeding
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
  test/                  # cross-module and HTTP integration tests
  **/*.test.ts           # focused tests colocated with their module
```

## Rules

- **Routes** validate request/auth/context and call modules (or injected `PlatformAppOptions`).
- **Modules** own domain behavior and factories used by composition.
- **Adapters** talk to Medusa, Chapa, and other providers.
- **index.ts** and **worker.ts** are the only long-running executable composition roots; bootstrap modules group cohesive runtime wiring.
- **scripts/** and **seeds/** contain one-shot executables and their reusable helpers.
- **types/** holds `PlatformAppOptions` and merchant/commerce result types.
- Import implementations from their canonical `context/`, `modules/`, or `adapters/` path; compatibility re-export folders are intentionally not maintained.
- Prefer new post-MVP resources under:
  - `routes/merchant/<resource>.ts`
  - `modules/<domain>/…`
  - `adapters/<provider>/…` when external I/O is required

## Media / new features

- Do **not** add new implementation under legacy re-export folders (`auth/`, `tenants/`, `billing/`, …).
- Prefer `modules/<domain>`, `adapters/<provider>`, `routes/merchant|platform|storefront|webhooks`.
- Dashboard server clients: `lib/platform-api/<resource>/` + thin named re-exports in `lib/merchant-*.ts` (no `"use client"`, no browser SDKs in those barrels).
