# Getting started

Requires Node.js 22, Corepack, pnpm 10.33.0, and Docker Compose.

```bash
corepack enable
pnpm install
cp .env.example .env
cp apps/platform-api/.env.example apps/platform-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/storefront/.env.example apps/storefront/.env
cp apps/medusa/.env.example apps/medusa/.env
pnpm db:reset --yes
pnpm seed --write-env
pnpm dev:apps
pnpm seed:demo
```

`pnpm dev` starts infrastructure, migrations, seed configuration, and apps together. `pnpm dev:infra` starts only Compose services (Postgres, Redis, Meilisearch, SeaweedFS, Caddy, Umami).

If host port 5432 is in use: `POSTGRES_HOST_PORT=5433 pnpm dev:infra`, then match database URLs in env files.

## Local hosts

`*.lvh.me` resolves to localhost. Compose Caddy routes:

| Host | App |
| --- | --- |
| `http://api.lvh.me` | Platform API :3000 |
| `http://app.lvh.me` | Dashboard :3001 |
| `http://dashboard.lvh.me` | Permanent redirect to `app.lvh.me` |
| `http://ops.lvh.me` | Operations :3002 |
| `http://addistech.lvh.me` | Demo storefront |
| `http://addistech.lvh.me/dashboard` | That shop’s merchant dashboard |
| `http://bolestyle.lvh.me` | Second demo shop |

On a shop host, `/api/*` is stripped and proxied to the Platform API so the browser stays same-origin.

Merchant dashboard paths start at `/dashboard`.

## Demo accounts

Created by `pnpm seed:demo`:

| Surface | Email | Password |
| --- | --- | --- |
| Addis Tech Hub | `yonatan@addistech.ecs.et` | `password1234` |
| Bole Style | `liya@bolestyle.ecs.et` | `password1234` |
| Operations | `operationsdemo@ecs.et` | `operations1234` |

`SEED_OWNER_PASSWORD` and `SEED_OPERATIONS_PASSWORD` override those passwords. Operations grants are recorded under the non-login identity `approvalsdemo@ecs.et` so local audit matches production (the actor who grants is not the signed-in operator).

Shop handles: `addistech`, `bolestyle`.

## After wiping databases

A stale commerce-engine admin token in `apps/platform-api/.env` causes catalog calls to 401.

1. `pnpm dev:infra`
2. `pnpm db:migrate` and `pnpm medusa:migrate`
3. `pnpm seed --write-env`
4. Restart the Platform API process so it loads the new token
5. `pnpm dev:apps`, then `pnpm seed:demo`

Do not run the demo seed on an environment that holds real merchant data.

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` / `pnpm test` / `pnpm lint` | Typecheck, tests, Biome |
| `pnpm db:generate` | Platform database migrations |
| `pnpm medusa:migrate` | Commerce-engine module migrations |
| `pnpm smoke:commerce` / `pnpm smoke:storefront` | HTTP smokes |
| `pnpm --filter @ecs/medusa search:reindex` | Rebuild the product search index |

## Storefront HTML cache

Platform API and storefront must share `STOREFRONT_CACHE_PURGE_SECRET`. Set `STOREFRONT_INTERNAL_BASE_URL` (local: `http://localhost:4321`) and `REDIS_URL`. Without the secret, published HTML is not purged until TTL.

## Chapa on localhost

`*.lvh.me` is not reachable from Chapa’s servers. Shop checkout that uses Chapa needs a publicly reachable callback URL. Return-URL verification and the billing reconcile job cover pending platform charges when the callback cannot land.
