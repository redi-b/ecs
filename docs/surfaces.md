# Surfaces

## Platform API — `apps/platform-api`

Hono. Serves `/platform/*`, `/store/*`, webhooks, the worker, and seeds.

New code goes under:

- `src/routes/merchant|platform|storefront|webhooks`
- `src/modules/<domain>`
- `src/adapters/medusa|chapa|storage`
- `src/context` — auth, tenant, dashboard authorization

`src/index.ts` wires env, database, jobs, and engine clients. `src/app.ts` is the HTTP app. Top-level folders such as `auth/` and `tenants/` are compatibility re-exports; do not add behavior there.

`GET /health` returns `{ ok: true }` and must stay cheap. Dependency checks belong in operator diagnostics, not in the container liveness probe.

Tests: `src/**/*.test.ts` with the platform app harness.

## Dashboard — `apps/dashboard`

Next.js App Router. Server-side Platform API clients live in `src/lib/platform-api/` (no `"use client"`, no browser SDK for the commerce engine). UI in `src/app` and `src/features`.

Copy is English and Amharic (`next-intl`). New strings need both catalogs. Visual language: `DESIGN.md`.

Shop work happens on `{shop}/dashboard`. `app.{base}` is authentication, shop selection, and onboarding.

Overview includes a launch assistant: required checks (shop profile, catalog, storefront review, fulfillment when it is not ready) with links into settings, products, and the editor. Merchants can hide it from shop settings.

## Storefront — `apps/storefront`

Astro SSR. Templates: `src/templates/<slug>/v<version>`. Commerce actions are shared; a template does not define its own cart or checkout protocol.

`GET /healthz` returns `ok`.

The visual editor previews the same Astro application (host-aware, preview secret).

## Commerce engine — `apps/medusa`

Admin UI is disabled (`DISABLE_MEDUSA_ADMIN`). Custom modules: Chapa payments, Meilisearch product index, notification subscribers. Do not fork the engine. Prefer its workflows for catalog and order mutations.

## Operations console — `apps/superadmin`

Next.js application served only on `ops.{base}`. Other hosts receive 404. Cookie prefix is `ecs-ops`. Access uses platform permissions, not a tenant membership role.

## Packages

| Package | Role |
| --- | --- |
| `@ecs/db` | Platform schema and migrations |
| `@ecs/contracts` | Shared Zod contracts |
| `@ecs/jobs` | Queues and job runs |
| `@ecs/config` | Environment helpers |
| `@ecs/logger` | Pino |
| `@ecs/storefront-templates` | Template schemas, defaults, editor manifests |
| `@ecs/billing` | Billing helpers |

## Infrastructure

- `infra/compose` — local stack; data services bind host ports so apps can run on the host
- `infra/docker` — application images (`linux/amd64`)
- Production Compose sits beside the VPS operator config under `infra/`

CI (`.github/workflows/build-images.yml`) publishes images and checks storefront i18n plus the production env validator. Run `pnpm test`, `typecheck`, and `lint` before merging work that touches tenancy, money, or auth.
