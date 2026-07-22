# Storefront

Astro multi-tenant storefront (`output: "server"`).

Public requests resolve tenant context from the host, load the published storefront revision, and render through a static template registry. Public rendering must never use draft data without a valid preview token.

## Buyer path

| Route | Purpose |
|-------|---------|
| `/` | Template home + merchandising sections |
| `/products` | Product list |
| `/products/:handle` | Product detail + add to cart |
| `/cart` | Cart line items |
| `/checkout` | COD checkout; Chapa only if merchant configured |
| `/checkout/payment-return` | Chapa return → complete cart |
| `/order/:id` | Confirmation (last-order cookie) |
| `/actions/*` | Server form handlers (not under `/api` — Caddy maps `/api` to Platform) |
| `/cart-count` | JSON cart badge for publicly cached pages (`private, no-store`) |
| `/internal/cache-purge` | Internal purge (shared secret; called by platform-api) |
| `/healthz` | Health check |

## Architecture

- Commerce ops: `src/lib/commerce/*` (shared; templates stay presentation)
- Session: `ecs_cart_id` cookie
- Platform calls: `PLATFORM_API_BASE_URL` + `x-forwarded-host`
- Templates: static registry (`classic@1`, …) — never dynamic import from DB
- **Chapa:** per-merchant secret on `payment_onboarding.secret_key` (never platform billing `CHAPA_SECRET_KEY`)
- **CSRF / reverse proxy:** `astro.config.mjs` sets `security.allowedDomains` so form POSTs work when TLS terminates at Caddy

### HTML caching (multi-tenant)

Catalog pages (home, PLP, PDP) use **SSR + Redis HTML cache** (Astro 7 cache provider). Keys always include **Host** so shops never share `/`.

| Surface | Caching |
|---------|---------|
| `/`, `/products`, `/products/:handle` | Public cache (`tenant:{id}`, `revision:{id}` tags) |
| `/cart`, `/checkout`, `/order/*`, `/actions/*` | `private, no-store` |
| Cart badge on catalog pages | Deferred via `/cart-count` (not baked into cached HTML) |

**Invalidation**

- Storefront **publish / unpublish** → platform purges `tenant:{tenantId}`
- Catalog writes (products, stock, categories, collections) → same purge
- Endpoint: `POST /internal/cache-purge` with header `x-ecs-cache-purge-secret`

See `dev-docs/07-storefront-routing.md`.

## Environment

Copy `apps/storefront/.env.example` → `.env`. Important vars:

| Variable | Purpose |
|----------|---------|
| `PLATFORM_API_BASE_URL` | Platform API origin |
| `REDIS_URL` | HTML cache store (optional; fail-open if down) |
| `STOREFRONT_CACHE_PREFIX` | Redis key prefix (default `ecs:sf:cache`) |
| `STOREFRONT_CACHE_PURGE_SECRET` | Must match platform-api for purge |
| `STOREFRONT_BASE_DOMAIN` / `STOREFRONT_PUBLIC_BASE_DOMAIN` | Multi-tenant host / CSRF |

Platform-api also needs `STOREFRONT_INTERNAL_BASE_URL` (e.g. `http://localhost:4321` or `http://storefront:4321`) and the same purge secret.

## Local

With apps running (`pnpm dev` / `pnpm dev:apps`):

- Demo shop: `http://addistech.lvh.me` (via Caddy)
- Browse → add to cart → checkout COD

COD needs Medusa shipping options for the cart. Chapa requires merchant credentials on the tenant (Settings → Payments).

## Plans / status

- v0 core: `dev-docs/post-mvp/12-storefront-commerce-core-plan.md`
- Completeness + template contracts: `dev-docs/post-mvp/14-storefront-completeness-and-templates-plan.md`
- Merchant Chapa: `dev-docs/post-mvp/13-merchant-online-payments-plan.md`
- Status: `dev-docs/00-current-status.md`
