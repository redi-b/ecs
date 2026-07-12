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

Better Auth issues secure session cookies for the shared `.${BASE_DOMAIN}` parent domain. This allows the central dashboard, tenant dashboards, and platform API to use the same session while keeping cookies HTTP-only and same-site.

The wildcard record does not cover the bare `ecs.example.com` host. Add that record separately only if the bare host will be used.

Wildcard DNS and wildcard TLS are separate concerns. The included demo certificate router uses ordinary Let's Encrypt certificates for `dashboard`, `api`, and `shop`, while the wildcard router forwards every one-level tenant hostname. New tenant hosts will show a certificate warning until a certificate for `*.ecs.example.com` is imported into Dokploy. Caddy intentionally handles internal HTTP only.

## Dokploy configuration

1. Create a Compose service from this repository and use `infra/dokploy/docker-compose.yml`.
2. Copy the values from `infra/dokploy/.env.example` into the Dokploy environment editor and replace every placeholder.
3. Configure GHCR credentials in Dokploy if the packages are private.
4. Configure the wildcard domain to target the `caddy` service on port `80` and let Dokploy handle public TLS.
5. Deploy with `IMAGE_TAG=main` after the GitHub Actions workflow has published the images.

Use URL-safe database passwords or percent-encode reserved characters in both database URLs. The two database URLs must use the same credentials configured for the Postgres service.

`MEDUSA_DATABASE_SSL=false` is intentional for the private Compose Postgres connection. Medusa maps this to `databaseDriverOptions.ssl=false` and `sslmode=disable`, avoiding the non-local-host SSL behavior that can leave migrations waiting indefinitely. Set it to `true` if the database is later moved to a TLS-enabled provider.

## Migrations and seeds

Deployments run platform and Medusa migrations as one-shot services before starting the applications. The platform migration job also synchronizes the built-in storefront template registry, so onboarding works on a fresh database without creating demo users or shops. Both jobs have a three-minute timeout, so a stuck migration fails visibly instead of holding the deployment open.

The Medusa migration and application containers use writable root filesystems because Medusa discovers and manages module directories at runtime. They still run as a non-root user with `no-new-privileges`. The platform API, dashboard, storefront, and Caddy remain read-only.

Seeds are not automatic. Run them from the Dokploy terminal when required:

```sh
docker compose -f infra/dokploy/docker-compose.yml run --rm medusa node_modules/.bin/medusa exec ./src/scripts/seed.js
docker compose -f infra/dokploy/docker-compose.yml run --rm platform-api node --import tsx src/seed.ts
docker compose -f infra/dokploy/docker-compose.yml run --rm platform-api node --import tsx src/seed-demo.ts
```

The Medusa seed creates the API credential used by the platform service. Store that value as `MEDUSA_ADMIN_API_TOKEN` in Dokploy and redeploy before using commerce provisioning features (including shop onboarding, which provisions Medusa commerce resources).

### Media (MinIO)

This stack runs MinIO for product and library uploads. Set `MINIO_ROOT_PASSWORD` (and optionally `MINIO_ROOT_USER` / `MINIO_BUCKET`) in Dokploy. Platform API talks to MinIO on the internal network (`http://minio:9000`) and serves public object URLs through `MEDIA_S3_PUBLIC_BASE_URL` (default `https://media.${BASE_DOMAIN}/${MINIO_BUCKET}`).

Point DNS for `media.${BASE_DOMAIN}` at the same Caddy/Traefik entry used by other app hosts, and set `MINIO_API_CORS_ALLOW_ORIGIN` to your dashboard origin so browser uploads can preflight.

Shop **create** does not require MinIO. Media uploads do. Onboarding failures are more often missing `MEDUSA_ADMIN_API_TOKEN`, auth/session issues, or Medusa health.

The platform image also contains `src/worker.ts`. It is not started by this stack because the current worker is only a placeholder; it can be added as a separate service when it begins processing jobs.

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
