# Storefront

Astro multi-tenant storefront.

Public requests resolve tenant context from the host, load the published storefront revision, and render through a static template registry. Public rendering must never use draft data without a valid preview token.

## Current scope (2026-07-16)

### Buyer path (functional / simple UI)

| Route | Purpose |
|-------|---------|
| `/` | Template home (classic) + featured products |
| `/products` | Product list |
| `/products/:handle` | Product detail + add to cart |
| `/cart` | Cart line items |
| `/checkout` | COD checkout; Chapa only if merchant configured |
| `/checkout/payment-return` | Chapa return → complete cart |
| `/order/:id` | Confirmation (last-order cookie) |
| `/actions/*` | Server form handlers (not under `/api` — Caddy maps `/api` to Platform) |

### Architecture

- Commerce ops: `src/lib/commerce/*` (reusable; templates should stay thin later)
- Session: `ecs_cart_id` cookie
- Platform calls: `PLATFORM_API_BASE_URL` + `x-forwarded-host`
- **Chapa:** per-merchant secret on `payment_onboarding.secret_key` (never platform billing `CHAPA_SECRET_KEY`)
- **CSRF / reverse proxy:** `astro.config.mjs` sets `security.allowedDomains` so form POSTs work when TLS terminates at Caddy (Origin is `https://…`, Node would otherwise see `http://…`)

Plans:

- v0 core: `dev-docs/post-mvp/12-storefront-commerce-core-plan.md`
- Completeness + template contracts: `dev-docs/post-mvp/14-storefront-completeness-and-templates-plan.md`
- Merchant Chapa (buyer → shop): `dev-docs/post-mvp/13-merchant-online-payments-plan.md`

Status: `dev-docs/00-current-status.md`

## Local

With apps running (`pnpm dev` / `pnpm dev:apps`):

- Demo shop: `http://addistech.lvh.me` (via Caddy)
- Browse → add to cart → checkout COD

COD needs Medusa shipping options for the cart. Chapa requires merchant credentials set on the tenant (not implemented as merchant dashboard UI yet; operator/DB for now).
