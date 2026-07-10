# Dokploy deployment

This stack is intended for a Dokploy Compose service. GitHub Actions builds the application images and pushes them to GHCR; Dokploy only pulls and runs them.

## DNS and routing

Set `BASE_DOMAIN` to the delegated application domain, for example `ecs.example.com`. A DNS record for `*.ecs.example.com` covers hosts such as:

- `api.ecs.example.com` for the platform API
- `dashboard.ecs.example.com` for the operator dashboard
- `<shop>.ecs.example.com` for tenant storefronts

The Compose service exposes Caddy on container port `80`. In Dokploy, point the wildcard domain to the `caddy` service on port `80`. The Compose file does not add Traefik labels, publish a host port, or attach Caddy to a Dokploy network manually.

The wildcard record does not cover the bare `ecs.example.com` host. Add that record separately only if the bare host will be used.

Wildcard DNS and wildcard TLS are separate concerns. HTTPS for arbitrary shop hosts requires a certificate for `*.ecs.example.com`, which normally uses a DNS-01 challenge or an imported wildcard certificate. If Dokploy is not configured for that certificate flow, add known shop domains individually until wildcard TLS is available. Caddy intentionally handles internal HTTP only.

## Dokploy configuration

1. Create a Compose service from this repository and use `infra/dokploy/docker-compose.yml`.
2. Copy the values from `infra/dokploy/.env.example` into the Dokploy environment editor and replace every placeholder.
3. Configure GHCR credentials in Dokploy if the packages are private.
4. Configure the wildcard domain to target the `caddy` service on port `80` and let Dokploy handle public TLS.
5. Deploy with `IMAGE_TAG=main` after the GitHub Actions workflow has published the images.

Use URL-safe database passwords or percent-encode reserved characters in both database URLs. The two database URLs must use the same credentials configured for the Postgres service.

`MEDUSA_DATABASE_SSL=false` is intentional for the private Compose Postgres connection. Medusa maps this to `databaseDriverOptions.ssl=false` and `sslmode=disable`, avoiding the non-local-host SSL behavior that can leave migrations waiting indefinitely. Set it to `true` if the database is later moved to a TLS-enabled provider.

## Migrations and seeds

Deployments run platform and Medusa migrations as one-shot services before starting the applications. Both commands have a three-minute timeout, so a stuck migration fails visibly instead of holding the deployment open.

Seeds are not automatic. Run them from the Dokploy terminal when required:

```sh
docker compose -f infra/dokploy/docker-compose.yml run --rm medusa node_modules/.bin/medusa exec ./src/scripts/seed.js
docker compose -f infra/dokploy/docker-compose.yml run --rm platform-api node --import tsx src/seed.ts
docker compose -f infra/dokploy/docker-compose.yml run --rm platform-api node --import tsx src/seed-demo.ts
```

The Medusa seed creates the API credential used by the platform service. Store that value as `MEDUSA_ADMIN_API_TOKEN` in Dokploy and redeploy before using commerce provisioning features.

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
