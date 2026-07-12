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

### Clean local databases (recommended before testing seed / onboarding)

Wipes Docker volumes for postgres/redis/minio, recreates empty DBs, and migrates:

```bash
pnpm db:reset:local --yes
pnpm seed:bootstrap --write-env
pnpm dev:apps
```

`seed:bootstrap` only:

1. Seeds Medusa (ETB region + **secret Admin API key**)
2. Syncs storefront templates
3. Optionally writes `MEDUSA_ADMIN_API_TOKEN` into `apps/platform-api/.env` (`--write-env`)

It does **not** create a demo shop. After bootstrap you can test real signup → create shop at `http://dashboard.lvh.me/admin`.

### Manual migrate + bootstrap

```bash
pnpm db:migrate
pnpm medusa:migrate
pnpm seed:bootstrap --write-env
```

### Optional local demo shop

Only for UI demos with sample catalog data (not required for onboarding, not for production):

```bash
pnpm seed                 # platform demo tenant + owner@selam.local
pnpm seed:demo            # needs MEDUSA_ADMIN_API_TOKEN; demo products/orders
pnpm seed:demo:clean      # remove demo commerce/platform rows
```

Demo product images use public placeholders (picsum). Merchant media uploads still use MinIO via `MEDIA_S3_*`.

### Start apps

```bash
pnpm dev:apps
# or with token override:
MEDUSA_ADMIN_API_TOKEN=<token> pnpm dev:apps
```

Grouped logs:

```bash
pnpm dev:apps:grouped
```

Full local startup (infra + apps):

```bash
pnpm dev
```

Stop local infrastructure:

```bash
pnpm dev:down
```

View infrastructure logs:

```bash
pnpm dev:logs
```

## Common Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check:fix
pnpm db:generate
pnpm db:migrate
pnpm medusa:migrate
pnpm seed
pnpm smoke:commerce
```

`pnpm smoke:commerce` signs in with the seeded owner account, creates a tenant, creates a category, creates a collection, creates a product, reads product detail, and reads stock. It expects the platform API and Medusa to already be running.

The smoke script uses these defaults:

- `PLATFORM_API_URL=http://localhost:3000`
- `PLATFORM_ORIGIN=http://dashboard.lvh.me`
- `SMOKE_OWNER_EMAIL=owner@selam.local`
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

Product stock management currently supports single-variant products. If a product has multiple variants, stock read and update endpoints return `product_variant_unsupported` instead of choosing a variant automatically. Variant-level inventory management should be added before enabling multi-variant product editing in the dashboard.

## Project Rules

- Do not expose Medusa Admin API publicly.
- Do not give merchants access to Medusa Admin.
- Do not trust tenant IDs supplied by the browser.
- Resolve tenant context from session, host, or verified server-side mapping.
- Keep platform data in the platform database.
- Keep commerce data in Medusa.
- Keep storefront cache keys scoped by tenant or hostname.
- Do not fork or patch Medusa core.
