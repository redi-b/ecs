# Architecture

ECS is one platform serving many shops. Merchants share tenancy, routing, and operations.

The commerce engine in this repository is Medusa. Use that name in implementation notes. Do not use it in merchant-facing copy.

```text
Internet
  → TLS at the edge
  → Caddy (Host and path routing)
       app.{base}              → dashboard
       ops.{base}              → operations console
       api.{base}              → platform-api
       media.{base}            → object storage (S3 API)
       {shop}.{base}           → storefront
       {shop}.{base}/dashboard → dashboard
       {shop}.{base}/api/*     → platform-api (prefix stripped)

Not on the public edge: commerce engine, Postgres, Redis, Meilisearch, Umami, object-storage admin
```

Applications take connection URLs (`PLATFORM_DATABASE_URL`, `MEDUSA_DATABASE_URL`, `REDIS_URL`, `MEDIA_S3_*`). The process that pulls images and runs Compose is an operator, not a domain boundary.

## Seams

**Commerce engine vs platform.** Catalog, cart, order, inventory, and shop customers live in the commerce engine. Tenants, authentication, billing plans, notifications, media library, editor documents, and operator audit live in the Platform API. Merchants never use the engine’s own admin UI.

**Store facade.** `/store/*` resolves the tenant from `Host`, injects that shop’s publishable key, and forwards storefront-safe commerce only. It is not a proxy of every engine route. `/platform/*` is first-party.

**One storefront application.** Templates are repository code (`luvia@1`, `nexahub@1`) plus JSON in the platform database. Merchants cannot upload HTML or JavaScript.

**Dashboard.** Talks only to the Platform API. Localization and tenancy are platform concerns.

**Operations.** Separate application, host `ops.{base}`, separate cookie prefix. Platform authority is not a tenant membership role.

## Databases

| Database | Stack | Owns |
| --- | --- | --- |
| `platform_db` | Drizzle (`packages/db`) | Users, sessions, tenants, memberships, billing, media rows, notifications, jobs, editor documents, analytics events, entitlements |
| `medusa_db` | Commerce engine | Products, variants, inventory, carts, orders, shop customers, promotions |
| `umami_db` | Umami | Product analytics |

A shop is a platform tenant plus a commerce-engine store, sales channel, and publishable key created at provision time. Do not show engine ids in merchant URLs.

Back up `platform_db` and `medusa_db` in the same window.

## Tenancy

Resolve tenant from:

1. authenticated session and membership
2. request `Host`
3. a verified domain mapping, when present

Never from a client-supplied tenant id. Unknown host → 404.

Shop hosts are one DNS label under `BASE_DOMAIN`. Entitlement `customDomains` is evaluated server-side and **fails closed** if evaluation is missing.

## Authentication

Better Auth on the Platform API, base path `/platform/auth`.

- Merchant cookie prefix: `ecs` (session `ecs.session_token`)
- Operations prefix: `ecs-ops` (must not equal the merchant prefix)
- `SameSite=lax`, httpOnly; `secure` when the public API URL is HTTPS
- Optional `BETTER_AUTH_COOKIE_DOMAIN=.{BASE_DOMAIN}` so `app.` and `{shop}.` share a merchant session
- Production: `AUTH_REQUIRE_EMAIL_VERIFICATION=true`
- Auth rate limits are stored in the platform database
- Storefront inquiry limits are in-process on the API

Trusted origins include the dashboard and `https://*.{BASE_DOMAIN}`.

## Caching

Storefront HTML may be cached in Redis. Keys include tenant or Host. After publish and catalog writes, Platform API purges via `STOREFRONT_CACHE_PURGE_SECRET` and `STOREFRONT_INTERNAL_BASE_URL`.

Hashed `/_next/static` is immutable at the edge. Dashboard HTML is `private, no-store`.

## Background work

`packages/jobs`: BullMQ plus job-run rows in Postgres. The platform worker is a separate process. The commerce engine runs in shared worker mode in its own container (`MEDUSA_WORKER_MODE=shared`). Two engine replicas would double subscribers unless worker mode is split.

Jobs include `email.deliver`, `notifications.deliver`, `billing.lifecycle`, `billing.reconcile-payments`, `analytics.commerce-rollup`, `product-import.apply`.

## Object storage

S3-compatible (`MEDIA_S3_*`). Compose uses SeaweedFS; the same adapter speaks R2 or S3. Browser uploads are presigned. Object keys: `tenants/{tenantId}/…`. Public read is allowed for product media; listing on the public media host can enumerate keys.
