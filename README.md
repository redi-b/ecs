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
- `http://abebe.lvh.me`
- `http://abebe.lvh.me/admin`

## Running Locally

Start infrastructure only:

```bash
pnpm dev:infra
```

Run migrations:

```bash
pnpm db:migrate
pnpm medusa:migrate
```

Start app processes after infrastructure is ready:

```bash
pnpm dev:apps
```

Run the full local startup flow:

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
```

## Medusa

The Medusa app is in `apps/medusa`.

Useful commands:

```bash
pnpm --filter @ecs/medusa dev
pnpm --filter @ecs/medusa dev:worker
pnpm --filter @ecs/medusa db:generate
pnpm --filter @ecs/medusa db:migrate
pnpm --filter @ecs/medusa seed
```

The API process runs with `WORKER_MODE=server`. The worker process runs with `WORKER_MODE=worker`. Local shared mode is available through `WORKER_MODE=shared`.

## Project Rules

- Do not expose Medusa Admin API publicly.
- Do not give merchants access to Medusa Admin.
- Do not trust tenant IDs supplied by the browser.
- Resolve tenant context from session, host, or verified server-side mapping.
- Keep platform data in the platform database.
- Keep commerce data in Medusa.
- Keep storefront cache keys scoped by tenant or hostname.
- Do not fork or patch Medusa core.
