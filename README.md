# ECS

ECS is a multi-tenant commerce platform built for Ethiopian merchants. It provides hosted storefronts, merchant operations, catalog and inventory management, checkout, payments, fulfillment, and customer accounts from a shared platform deployment.

## Repository structure

ECS is a pnpm and TypeScript monorepo.

| Workspace | Responsibility |
| --- | --- |
| `apps/platform-api` | Tenant management, authentication boundaries, billing, analytics, notifications, operator tools, and the public Store API facade |
| `apps/dashboard` | Merchant dashboard and public merchant-dashboard preview |
| `apps/superadmin` | Restricted standalone platform-operations console |
| `apps/storefront` | Multi-tenant Astro storefront and storefront editor preview |
| `apps/medusa` | Products, carts, orders, customers, inventory, payments, fulfillment, stores, and sales channels |
| `packages/contracts` | Shared validation schemas and API types |
| `packages/config` | Shared environment and configuration helpers |
| `packages/db` | Platform database schema and migrations |
| `packages/jobs` | Shared background-job infrastructure |
| `packages/logger` | Shared structured logging |
| `packages/storefront-templates` | Template contracts, defaults, editor manifests, theme generation, and migrations |

Public extension guidance is available in [docs](./docs/README.md), beginning with the
[storefront template guide](./docs/storefront-templates/adding-a-template.md).

Platform state is stored in `platform_db`, while commerce state is stored in `medusa_db`. Browser clients do not access Medusa directly. Storefront commerce requests pass through the tenant-aware `/store/*` facade in `platform-api`.

## Prerequisites

- Node.js 22 or newer
- Corepack
- pnpm 10.33.0
- Docker with Docker Compose

## Local setup

Install dependencies:

```bash
corepack enable
pnpm install
```

Create local environment files:

```bash
cp .env.example .env
cp apps/platform-api/.env.example apps/platform-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/storefront/.env.example apps/storefront/.env
cp apps/medusa/.env.example apps/medusa/.env
```

Initialize the databases and required platform data:

```bash
pnpm db:reset --yes
pnpm seed --write-env
```

Start the applications, then seed the optional demo shops after Medusa is ready:

```bash
pnpm dev:apps
pnpm seed:demo
```

Alternatively, `pnpm dev` starts infrastructure, applies migrations, writes required seed configuration, and starts the applications in one command.

### Local domains

Development uses `lvh.me`, which resolves to localhost:

- Platform API: `http://api.lvh.me`
- Dashboard: `http://dashboard.lvh.me`
- Operations: `http://ops.lvh.me`
- Demo storefront: `http://bole-style.lvh.me`
- Demo merchant dashboard: `http://bole-style.lvh.me/admin`

The demo seed creates local-only accounts for development:

| Shop | Email | Password |
| --- | --- | --- |
| Addis Tech Hub | `owner@addistech.local` | `password1234` |
| Bole Style | `owner@bole-style.local` | `password1234` |

The standalone operations console uses a separate platform identity; merchant accounts never receive
platform access:

| Console | Email | Password |
| --- | --- | --- |
| ECS Operations | `operations@ecs.local` | `operations1234` |

Run `pnpm seed:operations` to create or refresh only this account without requiring Medusa. The full
`pnpm seed:demo` command includes it as well. Set `SEED_OPERATIONS_PASSWORD` before either command to
override the local password. The
seed records grants under a separate, non-login `access-approver@ecs.local` identity so the demo keeps
the same authorization and audit boundary as a deployed environment without requiring a manual local
bootstrap.

Do not use demo credentials outside a local development environment.

### Storefront cache invalidation

For immediate storefront updates during development:

1. Set the same `STOREFRONT_CACHE_PURGE_SECRET` in the Platform API and Storefront environments.
2. Set `STOREFRONT_INTERNAL_BASE_URL=http://localhost:4321` in the Platform API environment.
3. Configure `REDIS_URL` for the Storefront.

Without cache invalidation, generated storefront HTML remains cached until its TTL expires.

### Chapa development

Store checkout and platform billing use Chapa. Configure `CHAPA_SECRET_KEY` and a publicly reachable `PLATFORM_PUBLIC_BASE_URL` for callback processing.

Local `*.lvh.me` domains are not reachable from Chapa. During local development, return confirmation and the `billing.reconcile-payments` worker reconcile pending billing payments. Start the Platform worker with:

```bash
pnpm --filter @ecs/platform-api dev:worker
```

## Development commands

### Applications and infrastructure

```bash
pnpm dev
pnpm dev:apps
pnpm dev:apps:grouped
pnpm dev:apps:split-medusa
pnpm dev:infra
pnpm dev:down
pnpm dev:logs
```

If port `5432` is unavailable, start PostgreSQL on another port and update the database URLs in the root, Platform API, and Medusa environment files:

```bash
POSTGRES_HOST_PORT=5433 pnpm dev:infra
```

### Quality checks

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check:fix
```

### Database and seed operations

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:reset --yes
pnpm medusa:migrate
pnpm seed --write-env
pnpm seed:demo
pnpm seed:demo:clean
```

`pnpm db:reset --yes` removes local Docker data before recreating and migrating the databases. `pnpm seed:demo` is idempotent and safe to run repeatedly.

### Integration checks

```bash
pnpm smoke:commerce
pnpm smoke:storefront
pnpm verify:media-cors
```

The commerce and storefront smoke checks require the relevant local services and seeded development accounts to be running.

## Medusa development

Medusa runs its server and worker together during normal local development:

```bash
pnpm --filter @ecs/medusa dev
```

Useful Medusa commands:

```bash
pnpm --filter @ecs/medusa dev:server
pnpm --filter @ecs/medusa dev:worker
pnpm --filter @ecs/medusa db:generate
pnpm --filter @ecs/medusa db:migrate
pnpm --filter @ecs/medusa seed
```

Use `pnpm dev:apps:split-medusa` when separate server and worker processes are required.

## Architecture principles

- Resolve tenant context from authenticated sessions, request hosts, or verified server-side mappings.
- Keep platform-owned data in the platform database and commerce-owned data in Medusa.
- Route public storefront commerce through the Platform Store API facade.
- Keep Medusa Admin APIs private and inaccessible to merchants.
- Scope storefront caches, customer state, carts, and media access by tenant.
- Treat storefront templates as contract-driven renderers rather than independent commerce implementations.
- Extend Medusa through supported modules, workflows, and API routes rather than modifying Medusa core.

## Deployment

Production deployment resources are maintained in [`infra/dokploy`](infra/dokploy/README.md). Review its environment, networking, storage, migration, and worker requirements before deploying.
