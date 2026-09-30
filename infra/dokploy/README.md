# Dokploy deployment

This stack is intended for a Dokploy Compose service. GitHub Actions builds the application images and pushes them to GHCR; Dokploy only pulls and runs them.

## DNS and routing

Set `BASE_DOMAIN` to the application's public base domain. It can be an apex such as `example.com`
(recommended now that ECS has a dedicated domain), or a delegated name such as `ecs.example.com`.
A wildcard DNS record for `*.${BASE_DOMAIN}` covers hosts such as:

- `api.ecs.example.com` for the platform API
- `app.ecs.example.com` for the merchant dashboard (`dashboard` redirects here)
- `media.ecs.example.com` for public media object URLs (MinIO)
- `<shop>.ecs.example.com` for tenant storefronts

The Compose service connects Caddy to Dokploy's external `dokploy-network` and defines a wildcard Traefik router for one-level subdomains. Remove any matching entries from Dokploy's Domains UI before deploying so Dokploy does not generate duplicate routers. Caddy remains connected to the default Compose network for internal service routing.

Caddy trusts forwarded headers only from private network peers so the dashboard receives the original public scheme and host after TLS terminates at Traefik. Its access log excludes the local `/healthz` probe.

### Static asset caching

Hashed Next.js chunks under `/_next/static/*` get `Cache-Control: public, max-age=31536000, immutable` from both the dashboard Next config and Caddy (dashboard host and shop-host `/_next/static` path). That keeps cold revisits from re-downloading megabytes of JS after the first load.

**Do not** long-cache `/admin` HTML or cookie-auth API responses — those stay `no-store` / uncached on purpose.

After deploy, spot-check:

```sh
# Should include max-age=31536000 (and usually immutable)
curl -sI "https://app.${BASE_DOMAIN}/_next/static/chunks/webpack-*.js" | grep -i cache-control

# Document must not be year-cached
curl -sI "https://app.${BASE_DOMAIN}/admin" | grep -i cache-control
```

Public media (`media.${BASE_DOMAIN}`) gets a one-week cache with stale-while-revalidate for product thumbs.

Better Auth issues secure session cookies for the shared `.${BASE_DOMAIN}` parent domain. This allows the central dashboard, tenant dashboards, and platform API to use the same session while keeping cookies HTTP-only and same-site.

The wildcard record does not cover `BASE_DOMAIN` itself. Create both records at the authoritative DNS
provider:

- `BASE_DOMAIN` (`@` when it is the zone apex) → the Dokploy/Traefik public IP.
- `*.BASE_DOMAIN` → the same public IP (A/AAAA), or a CNAME to `BASE_DOMAIN` when the provider permits it.

Wildcard **DNS** and wildcard **TLS** are separate concerns.

**TLS:**

| Hosts | Certificate |
|-------|-------------|
| `BASE_DOMAIN` | Included explicitly as the certificate's main name (the landing page) |
| `*.BASE_DOMAIN` | One wildcard SAN covers `app`, `api`, `media`, `ops`, `demo`, and every one-level merchant shop |

Wildcard DNS routes shop traffic but does not provide wildcard TLS. Certificate ownership belongs
to the shared Dokploy/Traefik edge, not the ECS Compose stack. The Compose router enables TLS but
intentionally declares no ACME certificate resolver. Traefik selects a matching certificate from its
shared store by SNI and falls back to its configured/generated default certificate when none exists.

The current `ecset.dev` deployment uses a Cloudflare Origin CA certificate between Cloudflare and
Dokploy/Traefik. It contains both `BASE_DOMAIN` and `*.BASE_DOMAIN`. Cloudflare serves the publicly
trusted visitor certificate; Traefik serves the Origin CA certificate to Cloudflare.

Requirements:

1. Create proxied Cloudflare DNS records for both `BASE_DOMAIN` and `*.BASE_DOMAIN`, pointing to the
   Dokploy/Traefik public address.
2. In Cloudflare, create one PEM Origin CA certificate with SANs for `BASE_DOMAIN` and
   `*.BASE_DOMAIN`.
3. Add the certificate and private key through Dokploy's **Certificates** UI for the target server.
   Confirm Traefik's dynamic configuration recognizes it. Do not commit the key or place either PEM
   value in the ECS environment.
4. Set Cloudflare SSL/TLS encryption mode to **Full (strict)** only after the origin certificate is
   installed. A missing, expired, or hostname-mismatched origin certificate produces Cloudflare 526.
5. Track the certificate expiry independently. Cloudflare does not send Origin CA expiry notices.

During initial setup, Traefik's self-signed/generated default certificate is an acceptable temporary
fallback behind Cloudflare **Full** mode. It is not valid for **Full (strict)** and is not a
production-complete state. Installing the Origin CA certificate in Dokploy requires no ECS Compose
change or redeploy of certificate material; the shared Traefik file provider loads it independently.

See the official [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/),
[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/),
and [Dokploy Cloudflare](https://docs.dokploy.com/docs/core/domains/cloudflare) guidance.

**Caveats:**

- `*.example.com` covers `shop.example.com`, but not `example.com` and not `x.shop.example.com`.
- Cloudflare Origin CA certificates are not publicly trusted. All public ECS records must remain
  proxied; direct browser access to the origin is not a supported path.
- Traefik's generated certificate is a bootstrap fallback only. Cloudflare Full accepts it without
  validating trust; Full (strict) correctly rejects it.
- A single apex + wildcard Origin CA certificate avoids per-shop certificate work.
- Caddy only speaks **HTTP** internally; public TLS terminates at Traefik.

## Dokploy configuration

1. Create a Compose service from this repository and use `infra/dokploy/docker-compose.yml`.
2. Copy the values from `infra/dokploy/.env.example` into the Dokploy environment editor and replace every placeholder.
3. Configure GHCR credentials in Dokploy if the packages are private.
4. Point proxied Cloudflare records for both `BASE_DOMAIN` and `*.${BASE_DOMAIN}` at the host /
   Traefik that fronts this stack. Do **not** create overlapping domain entries in Dokploy's Domains
   UI because they generate duplicate routers.
5. Add the apex + wildcard Cloudflare Origin CA certificate in Dokploy and confirm Traefik loads it.
   Use Cloudflare Full only during bootstrap, then switch to Full (strict). No DNS-provider API
   credential, certificate secret, or ACME resolver belongs in ECS Compose.
6. Deploy with `IMAGE_TAG=main` after the GitHub Actions workflow has published the images.

Before the first production deploy, copy `.env.example` to a private local file, replace every
placeholder, and run the repository preflight:

```sh
pnpm validate:production-env -- /absolute/path/to/production.env
```

The preflight rejects weak/placeholder/reused secrets, mismatched database credentials, shared
Platform/Medusa databases, malformed public media origins, and half-configured notification
providers. A mutable `IMAGE_TAG=main` produces a warning; use the published `sha-<git-sha>` tag for
rollback-safe releases.

The stack also starts one internal Umami service. It uses a separate `umami_db` database on the
existing PostgreSQL server, so it does not add another database container. Set a unique
`UMAMI_APP_SECRET`; Umami is not exposed through the public Caddy routes.
For administration, tunnel the host's loopback-only port (default `3003`) over SSH. The first boot
uses Umami's `admin` / `umami` bootstrap login. Change that password immediately, update
`UMAMI_PASSWORD` in Dokploy, and redeploy Platform API.

For backup, restore, rollback, and post-deploy gates, follow [`OPERATIONS.md`](./OPERATIONS.md).

After deploy, verify the apex and a never-before-used `https://<new-shop>.${BASE_DOMAIN}` hostname
through Cloudflare. Both must succeed immediately without a first-visit issuance attempt or a 526
response.

Use URL-safe database passwords or percent-encode reserved characters in both database URLs. The two database URLs must use the same credentials configured for the Postgres service.

`MEDUSA_DATABASE_SSL=false` is intentional for the private Compose Postgres connection. Medusa maps this to `databaseDriverOptions.ssl=false` and `sslmode=disable`, avoiding the non-local-host SSL behavior that can leave migrations waiting indefinitely. Set it to `true` if the database is later moved to a TLS-enabled provider.

## Migrations and seeds

Deployments run platform and Medusa migrations as one-shot services before starting the applications. The platform migration job also synchronizes the built-in storefront template registry, so onboarding works on a fresh database **without** demo users or shops. Both jobs have a three-minute timeout, so a stuck migration fails visibly instead of holding the deployment open.

The Medusa migration and application containers use writable root filesystems because Medusa discovers and manages module directories at runtime. They still run as a non-root user with `no-new-privileges`. The platform API, dashboard, storefront, and Caddy remain read-only.

### After first deploy

Production does **not** need demo seeds for real merchants. Migrations + template sync run on deploy.

**Medusa admin credentials:** platform-api bootstraps automatically on startup when `MEDUSA_ADMIN_API_TOKEN` is unset. It calls Medusa’s internal bootstrap route (authenticated with `PLATFORM_INTERNAL_API_TOKEN`), then stores the secret encrypted in `platform_system_secrets`. Encryption uses `PLATFORM_SECRETS_ENCRYPTION_KEY` if set, otherwise `BETTER_AUTH_SECRET`.

- Leave `MEDUSA_ADMIN_API_TOKEN` empty for auto-bootstrap (recommended).
- Set `MEDUSA_ADMIN_API_TOKEN` only to override (local tooling, rotation, break-glass).

Optional manual seed (break-glass):

```sh
docker compose exec medusa node_modules/.bin/medusa exec ./src/scripts/seed.js
```

### Optional demo seed (showcase / staging)

Demo seed runs **inside** the `platform-api` container (no host `pnpm` required). Compose injects both `PLATFORM_DATABASE_URL` and `MEDUSA_DATABASE_URL` so order **backdating** can open Medusa’s Postgres directly.

**Medusa admin token:** leave `MEDUSA_ADMIN_API_TOKEN` empty. After platform-api has started once (auto-bootstrap into `platform_system_secrets`), demo-seed resolves the same encrypted secret (or re-bootstraps via `PLATFORM_INTERNAL_API_TOKEN`). You do **not** need to put a key in `.env` for seed.

**Media:** seed PutObject uses `MEDIA_S3_INTERNAL_ENDPOINT` (default `http://seaweedfs:8333`), not the public `MEDIA_S3_ENDPOINT`. Browser URLs still use `MEDIA_S3_PUBLIC_BASE_URL`.

The showcase catalog uses a checked-in manifest of product-matched Pexels photographs under the
[Pexels license](https://www.pexels.com/license/). The seed copies each image into ECS media storage
and records its source page in Medusa product metadata. If an individual copy fails, that image uses
its curated CDN URL instead; the seed never substitutes an unrelated random photograph.

```sh
# Ensure platform-api has started at least once (token bootstrap), then:
docker compose exec platform-api node --import tsx src/seeds/demo-seed.ts

# Remove demo data
docker compose exec platform-api node --import tsx src/seeds/demo-seed.ts --clean
```

Logs to expect:

- `[seed:demo] Medusa admin token ready (source=db|bootstrap|env, …)`
- `[seed:demo] Media S3: bucket=… apiEndpoint=http://seaweedfs:8333 …`

If media uploads fail, confirm Seaweed is healthy and `MEDIA_S3_INTERNAL_ENDPOINT=http://seaweedfs:8333` is set on platform-api.

If backdating logs `localhost:5432`, the process is missing `MEDUSA_DATABASE_URL` (should be `postgres://…@postgres:5432/medusa_db` on Dokploy, not localhost).

1. Deploy (migrations + auto Medusa admin bootstrap)
2. Optional: `docker compose exec platform-api node --import tsx src/seeds/demo-seed.ts`
3. Or sign up on the dashboard and create a shop  

Debug shop create: platform-api `[platform/tenants]`, dashboard `[onboarding/submit]`.

### Media (SeaweedFS S3)

This stack runs **SeaweedFS** (S3-compatible) for product and library uploads (replaces MinIO). Set `MEDIA_S3_SECRET_ACCESS_KEY` (and optionally `MEDIA_S3_ACCESS_KEY_ID` / `MEDIA_S3_BUCKET`) in Dokploy.

| Variable | Used for |
|----------|----------|
| `MEDIA_S3_ENDPOINT` | Browser **presigned** PUT host (public `https://media.${BASE_DOMAIN}`) |
| `MEDIA_S3_INTERNAL_ENDPOINT` | Server Head/Put/Delete + demo-seed; default `http://seaweedfs:8333` |
| `MEDIA_S3_PUBLIC_BASE_URL` | Object URLs stored on media assets / product images |
| `MEDIA_S3_MIN_FREE_SPACE` | Disk reserve before uploads pause; defaults to `1GiB` |

Caddy reverse-proxies `media.${BASE_DOMAIN}` → `seaweedfs:8333` and **preserves the original `Host` header** so SigV4 on browser PUTs still matches. Point DNS for `media.${BASE_DOMAIN}` at the same entry used by other app hosts. Keep `MEDIA_S3_CORS_ALLOW_ORIGIN=*`: browser uploads may originate from the dashboard, tenant subdomains, or custom shop domains. This only permits those browsers to attempt a request; every upload still requires a short-lived, object-specific signed URL and accepted method and headers.

If uploads fail with red network rows on the media host: confirm (1) Host is preserved, (2) presigned URLs lack `x-amz-checksum-*` query params (platform-api disables flexible checksums), (3) a PUT preflight from a shop dashboard origin returns 204 with its exact `Access-Control-Allow-Origin`. Deploy/reload Caddy for the shop-origin CORS route to take effect.

Shop **create** does not require object storage. Media uploads and full demo seed images do.

**Cutover from MinIO:** drop the old `minio-data` volume (or leave it unused), set the new `MEDIA_S3_*` secrets, redeploy. Re-upload media or reseed — no automatic object migration.

The platform image runs two processes from the same image: `platform-api` (HTTP) and `platform-worker` (BullMQ via `@ecs/jobs`). The worker command is `node --import tsx src/worker.ts`. It requires Redis and platform migrations, and is required for background jobs (notifications, billing, imports, and other post-MVP work).

Billing-related **BullMQ repeatable** jobs (registered on worker start; override via env):

- `billing.reconcile-payments` — re-verify pending Chapa plan invoices (`BILLING_RECONCILE_INTERVAL_MS`, default 5 minutes)
- `billing.lifecycle` — renewals, past_due, scheduled free downgrades (`BILLING_LIFECYCLE_INTERVAL_MS`, default 1 hour)

Set `PLATFORM_PUBLIC_BASE_URL` to the public HTTPS API origin so Chapa `callback_url` works in production.

## GitHub Actions

The workflow uses the repository `GITHUB_TOKEN` to publish these packages:

- `ghcr.io/<owner>/<repository>/platform-api`
- `ghcr.io/<owner>/<repository>/medusa`
- `ghcr.io/<owner>/<repository>/dashboard`
- `ghcr.io/<owner>/<repository>/storefront`

No storefront or dashboard build-time variables are currently required. Both applications read `PLATFORM_API_BASE_URL` at runtime on the server. The existing `NEXT_PUBLIC_*` entries are not referenced by the dashboard build.

### Storefront HTML cache purge

Platform-api invalidates public storefront HTML after **publish/unpublish** and successful **catalog writes** (products, stock, taxonomy). Compose injects:

| Variable | Where | Notes |
|----------|--------|--------|
| `STOREFRONT_CACHE_PURGE_SECRET` | platform-api + storefront | Required in `.env` (long random value) |
| `STOREFRONT_INTERNAL_BASE_URL` | platform-api | Set to `http://storefront:4321` in compose |
| `REDIS_URL` | storefront (+ platform already) | HTML cache store |

See `apps/storefront/README.md` for storefront cache and routing details.

To enable the optional deployment trigger, add all three repository secrets:

- `DOKPLOY_API_URL`, such as `https://dokploy.example.com`
- `DOKPLOY_API_KEY`
- `DOKPLOY_COMPOSE_ID`

If `DOKPLOY_API_KEY` is absent, the workflow publishes the images and skips deployment. If it is present, the other two values are required. The API call uses Dokploy's `POST /api/compose.deploy` endpoint with the `x-api-key` header.
