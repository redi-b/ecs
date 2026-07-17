# Dokploy deployment

This stack is intended for a Dokploy Compose service. GitHub Actions builds the application images and pushes them to GHCR; Dokploy only pulls and runs them.

## DNS and routing

Set `BASE_DOMAIN` to the delegated application domain, for example `ecs.example.com`. A DNS record for `*.ecs.example.com` covers hosts such as:

- `api.ecs.example.com` for the platform API
- `dashboard.ecs.example.com` for the merchant dashboard
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
curl -sI "https://dashboard.${BASE_DOMAIN}/_next/static/chunks/webpack-*.js" | grep -i cache-control

# Document must not be year-cached
curl -sI "https://dashboard.${BASE_DOMAIN}/admin" | grep -i cache-control
```

Public media (`media.${BASE_DOMAIN}`) gets a one-week cache with stale-while-revalidate for product thumbs.

Better Auth issues secure session cookies for the shared `.${BASE_DOMAIN}` parent domain. This allows the central dashboard, tenant dashboards, and platform API to use the same session while keeping cookies HTTP-only and same-site.

The wildcard record does not cover the bare `ecs.example.com` host. Add that record separately only if the bare host will be used.

Wildcard **DNS** and wildcard **TLS** are separate concerns.

**TLS (current approach — option 1, on-demand per host):**

| Hosts | Certificate |
|-------|-------------|
| `dashboard`, `api`, `shop`, `media` | Explicit Traefik router + Let's Encrypt HTTP-01 (priority 100) |
| Any other `{shop}.${BASE_DOMAIN}` | Catch-all router + **same** `letsencrypt` resolver — Traefik requests a **normal (non-wildcard)** cert for that hostname on first HTTPS visit |

You do **not** need a manual `*.BASE_DOMAIN` certificate for shop storefronts. Requirements:

1. DNS: `*.${BASE_DOMAIN}` A/AAAA (or CNAME) pointing at the Traefik entry (same as today).
2. Port **80** publicly reachable so ACME HTTP-01 can succeed (challenge path is not redirected to HTTPS).
3. Traefik cert resolver name **`letsencrypt`** (Dokploy default) with HTTP challenge on the `web` entrypoint.

**Caveats:**

- First HTTPS hit to a new shop may take a few seconds while Let's Encrypt issues the cert; rare temporary TLS errors on that first request are expected.
- Let's Encrypt rate limits apply (roughly 50 new certs per registered domain per week). Burst-creating many shops can hit the limit.
- Caddy only speaks **HTTP** internally; public TLS terminates at Traefik.

Optional later upgrade: DNS-01 **wildcard** cert if you prefer one cert for all shops (not required with this setup).

## Dokploy configuration

1. Create a Compose service from this repository and use `infra/dokploy/docker-compose.yml`.
2. Copy the values from `infra/dokploy/.env.example` into the Dokploy environment editor and replace every placeholder.
3. Configure GHCR credentials in Dokploy if the packages are private.
4. Point wildcard DNS (`*.${BASE_DOMAIN}`) at the host / Traefik that fronts this stack. Do **not** create conflicting per-shop domain entries in Dokploy’s Domains UI for the same hosts (they duplicate routers). Traefik labels on `caddy` own routing + LE certs.
5. Confirm Dokploy/Traefik has cert resolver **`letsencrypt`** with **HTTP-01** on entrypoint `web` (standard Dokploy setup).
6. Deploy with `IMAGE_TAG=main` after the GitHub Actions workflow has published the images.

After deploy, open `https://<any-new-shop>.${BASE_DOMAIN}` once; the cert should become valid without importing a wildcard PEM.

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
| `MEDIA_S3_ENDPOINT` | Browser **presigned** uploads (public `https://media.${BASE_DOMAIN}`) |
| `MEDIA_S3_INTERNAL_ENDPOINT` | Server **PutObject** (demo-seed); default `http://seaweedfs:8333` |
| `MEDIA_S3_PUBLIC_BASE_URL` | Object URLs stored on media assets / product images |

Caddy reverse-proxies `media.${BASE_DOMAIN}` → `seaweedfs:8333`. Point DNS for `media.${BASE_DOMAIN}` at the same entry used by other app hosts, and set `MEDIA_S3_CORS_ALLOW_ORIGIN` to your dashboard origin so browser uploads can preflight.

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

To enable the optional deployment trigger, add all three repository secrets:

- `DOKPLOY_API_URL`, such as `https://dokploy.example.com`
- `DOKPLOY_API_KEY`
- `DOKPLOY_COMPOSE_ID`

If `DOKPLOY_API_KEY` is absent, the workflow publishes the images and skips deployment. If it is present, the other two values are required. The API call uses Dokploy's `POST /api/compose.deploy` endpoint with the `x-api-key` header.
