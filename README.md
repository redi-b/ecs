# ECS

ECS is a hosted commerce platform for Ethiopian merchants. It gives each merchant a public storefront, a private dashboard, and a commerce backend without requiring a separate deployment per shop.

## Architecture

The repository is a pnpm TypeScript monorepo.

- `apps/platform-api` is the platform API. It owns tenants, domains, auth boundaries, billing state, notification state, analytics state, operator tools, and the public Store API facade.
- `apps/dashboard` is the merchant and operator dashboard.
- `apps/storefront` is the public multi-tenant storefront.
- `apps/medusa` is the Medusa commerce backend. It owns products, carts, orders, customers, inventory, payment state, fulfillment state, stores, sales channels, and publishable API keys.
- `packages/contracts` contains shared validation schemas and API types.
- `packages/config` contains shared environment/config helpers.
- `packages/db` contains the platform database schema and migrations.
- `packages/logger` contains shared structured logging.
- `packages/storefront-templates` contains storefront template manifests, schemas, defaults, and migration helpers.

Platform state and commerce state are separate:

- Platform state lives in `platform_db`.
- Commerce state lives in `medusa_db`.
- Browser clients do not call Medusa directly.
- Public storefront commerce requests go through the platform `/store/*` facade, where tenant context and publishable keys are handled server-side.

## Requirements

- Node.js 22 or newer
- Corepack
- pnpm 10.33.0
- Docker with Docker Compose

Enable Corepack before installing dependencies:

```bash
corepack enable
pnpm install
```

## Environment

Copy the example files before running services:

```bash
cp .env.example .env
cp apps/platform-api/.env.example apps/platform-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/storefront/.env.example apps/storefront/.env
cp apps/medusa/.env.example apps/medusa/.env
```

Development defaults use `lvh.me`, which resolves to localhost:

- `http://api.lvh.me`
- `http://dashboard.lvh.me`
- `http://selam.lvh.me`
- `http://selam.lvh.me/admin`

### Chapa payments (local notes)

- Platform billing and store checkout both use Chapa. The API sets **callback_url** from `PLATFORM_PUBLIC_BASE_URL` (must be reachable by Chapa in real deploys).
- Local `*.lvh.me` is not reachable from Chapa’s servers. Billing still completes via **return_url confirm** and the worker job **`billing.reconcile-payments`** (re-verifies pending `ecs_bill_*` invoices). Run `pnpm --filter @ecs/platform-api dev:worker` with Redis.
- Set `CHAPA_SECRET_KEY` and, for demo `*.local` owner emails, `CHAPA_FALLBACK_EMAIL` to a real mailbox Chapa accepts.
- Details: `dev-docs/post-mvp/09-billing-v1-free-and-growth.md`.

## Running Locally

Start infrastructure only:

```bash
pnpm dev:infra
```

If another PostgreSQL server is already using port `5432`, use a different local port:

```bash
POSTGRES_HOST_PORT=5433 pnpm dev:infra
```

When using a different PostgreSQL port, update the local database URLs in `.env`, `apps/platform-api/.env`, and `apps/medusa/.env` to use the same port.

### Seeds (bootstrap only)

| Command | Purpose |
|--------|---------|
| `pnpm db:reset --yes` | Wipe local Docker volumes, recreate DBs, migrate |
| `pnpm seed --write-env` | **Always run this:** Medusa admin secret key + storefront templates |
| `pnpm seed:demo` | Idempotent demo shops (tech + fashion); safe to re-run |
| `pnpm seed:demo:clean` | Reverse demo seed (`pnpm seed:unseed` alias) |

Medusa bootstrap seed: `apps/medusa/src/scripts/seed.ts`. Demo shops: `pnpm seed:demo` (tech + fashion, two owners).

Fresh local setup:

```bash
pnpm install
# copy .env files once (see Environment above)

pnpm db:reset --yes
pnpm seed --write-env
pnpm dev:apps
# after Medusa is up:
pnpm seed:demo
```

Demo credentials:

| Shop | Dashboard | Owner | Password |
| --- | --- | --- | --- |
| Addis Tech Hub | `http://addistech.lvh.me/admin` | `owner@addistech.local` | `password1234` |
| Bole Style | `http://bole-style.lvh.me/admin` | `owner@bole-style.local` | `password1234` |

- Onboarding test: `http://dashboard.lvh.me` → sign up → create shop  
- Merchant image uploads use SeaweedFS S3 (`MEDIA_S3_*`; local compose service `seaweedfs`).

### Start apps

```bash
pnpm dev              # infra + migrate + seed --write-env + apps
pnpm dev:apps         # apps only (infra already running)
pnpm dev:apps:grouped # apps with grouped terminal panels
pnpm dev:down
pnpm dev:logs
```

## Common Commands

```bash
# quality
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check:fix

# data
pnpm db:generate
pnpm db:migrate
pnpm db:reset --yes
pnpm medusa:migrate
pnpm seed --write-env
pnpm seed:demo
pnpm seed:demo:clean

# checks
pnpm smoke:commerce
pnpm smoke:storefront
pnpm verify:media-cors
```

`pnpm smoke:storefront` runs a published shop COD path against Platform `/store/*` (default host `addistech.lvh.me`). Shop must be published and Medusa `medusa_publishable_key_id` must store the publishable **token** (`pk_…`), not the api key row id.

`pnpm smoke:commerce` creates an ephemeral smoke tenant (category, collection, product, stock). It expects the platform API and Medusa to already be running, plus a sign-in capable owner account.

The smoke script uses these defaults:

- `PLATFORM_API_URL=http://localhost:3000`
- `PLATFORM_ORIGIN=http://dashboard.lvh.me`
- `SMOKE_OWNER_EMAIL=owner@addistech.local`
- `SMOKE_OWNER_PASSWORD=password1234`

Override those values in the shell if your local setup is different.

## Medusa

The Medusa app is in `apps/medusa`.

Useful commands:

```bash
pnpm --filter @ecs/medusa dev
pnpm --filter @ecs/medusa dev:server
pnpm --filter @ecs/medusa dev:worker
pnpm --filter @ecs/medusa db:generate
pnpm --filter @ecs/medusa db:migrate
pnpm --filter @ecs/medusa seed
```

Local development runs Medusa in shared mode by default. Shared mode runs the Medusa server and worker in one process, which avoids local port conflicts and is enough for normal development.

Split Medusa mode is still available when needed:

```bash
pnpm dev:apps:split-medusa
```

In split mode, the Medusa server uses port `9000` and the Medusa worker uses port `9001`.

The local event bus and in-memory locking warnings from Medusa are expected in development. They should be replaced with production services before deployment.

## Commerce MVP Scope

The platform API supports tenant-scoped catalog, stock, checkout, payment, and order operations through Medusa.

Product stock: **per-variant** stock APIs and dashboard UI are the multi-variant path. The product-level stock endpoint still returns `product_variant_unsupported` when a product has multiple variants (it will not pick a variant for you). Prefer variant stock routes for multi-variant products.

Public storefront buyer path (PDP → cart → COD checkout, optional Chapa when merchant-configured) lives in `apps/storefront` — see `dev-docs/post-mvp/12-storefront-commerce-core-plan.md` and `pnpm smoke:storefront`.

## Project Rules

- Do not expose Medusa Admin API publicly.
- Do not give merchants access to Medusa Admin.
- Do not trust tenant IDs supplied by the browser.
- Resolve tenant context from session, host, or verified server-side mapping.
- Keep platform data in the platform database.
- Keep commerce data in Medusa.
- Keep storefront cache keys scoped by tenant or hostname.
- Do not fork or patch Medusa core.
