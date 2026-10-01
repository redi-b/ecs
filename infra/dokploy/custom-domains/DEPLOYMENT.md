# Production custom-domain deployment

Use this after the normal ECS Dokploy setup. No separate test deployment is
required. Keep the existing ECS project name and application volumes unchanged.
This procedure uses the Compose add-on at `infra/dokploy/custom-domains.compose.yml`,
the gateway Caddyfile at `infra/dokploy/custom-domains/Caddyfile`, and the one-time
Traefik backend file at `infra/dokploy/custom-domains/backend.yml`.

## 1. DNS and Traefik prerequisites

Create DNS-only `domains.ecset.dev` pointing to the VPS public ingress IPv4.
Do not add AAAA unless IPv6 ingress is explicitly supported and verified.
Traefik must have its file provider watching `/etc/dokploy/traefik/dynamic`, a
production `letsencrypt` HTTP-01 resolver, and public ports 80/443 reachable.
Keep its API private on `dokploy-network`; never publish port 8080.
Managed-host Cloudflare Origin CA configuration remains separate and unchanged.

## 2. Prepare the production route directory and backend

From the repository checkout on the VPS, as an operator:

```sh
ecs_api_container=$(docker ps --filter name=platform-api --format '{{.Names}}' | head -n 1)
test -n "$ecs_api_container"
ecs_route_uid=$(docker exec "$ecs_api_container" id -u node)
ecs_route_gid=$(docker exec "$ecs_api_container" id -g node)
install -d -o "$ecs_route_uid" -g "$ecs_route_gid" -m 0750 \
  /etc/dokploy/traefik/dynamic/ecs-custom-domains
if [ -e /etc/dokploy/traefik/dynamic/ecs-custom-domains-backend.yml ]; then
  echo 'Existing backend file found; inspect it before continuing.' >&2
  exit 1
fi
install -m 0644 \
  infra/dokploy/custom-domains/backend.yml \
  /etc/dokploy/traefik/dynamic/ecs-custom-domains-backend.yml
```

The command above installs the tracked backend file only after confirming the
destination is unused. If the repository is not on the VPS, securely transfer
that one file first. It declares a backend, not routers.

The current ECS image uses UID/GID `1000:1000`, but the runbook intentionally
derives the values from the running image. If a future image changes its runtime
user, the preparation remains correct without changing the host command.

## 3. Configure the ECS Compose application in Dokploy

Add these to that application's Environment section, not Dokploy's own service:

```dotenv
ECS_CUSTOM_DOMAINS_ENABLED=true
ECS_DOMAIN_ROUTE_HOST_DIRECTORY=/etc/dokploy/traefik/dynamic/ecs-custom-domains
ECS_DOMAIN_INGRESS_IPV4=<your VPS public ingress IPv4>
ECS_DOMAIN_CERT_RESOLVER=letsencrypt
```

Use the IPv4 behind the DNS-only ECS target, not a Docker/Cloudflare proxy IP.
Remove the obsolete `ECS_CUSTOM_DOMAINS_BETA` entry if present. Select the branch
and its built image tag through the normal ECS deployment workflow; changing
`IMAGE_TAG` alone does not build/publish images.

## 4. Deploy base Compose plus the production overlay

Keep the ordinary Compose Path. In Dokploy's advanced custom Command use:

```text
compose -p <existing-project-name> -f infra/dokploy/docker-compose.yml -f infra/dokploy/custom-domains.compose.yml up -d
```

Dokploy prepends `docker`. Substitute the exact existing application project name.
The second file merges into the first: API and worker gain the restricted route
mount/private ingress network, and a storefront-only gateway is added. It does
not create a second ECS application or replace the base Compose configuration.

The overlay injects these runtime values automatically:

| Setting | Source and meaning |
| --- | --- |
| `ECS_DOMAIN_ROUTE_DIRECTORY` | `/var/lib/ecs-domain-routes`: container path bound to the host route directory |
| `ECS_DOMAIN_TRAEFIK_API_URL` | `http://dokploy-traefik:8080`: private provider acceptance checks |
| `ECS_DOMAIN_INGRESS_IPV4` | The public IPv4 you entered above: DNS/HTTPS ingress verification |
| `ECS_DOMAIN_STOREFRONT_SERVICE` | `ecs-custom-domains-storefront@file`: service in the installed backend YAML |

Apply migrations through the existing deployment workflow. Check API/worker health
and logs, and confirm ordinary managed storefront/dashboard/API access still works.
Leave domains disabled in bare local development without this ingress setup.

## 5. Confirm shop access

The current policy includes custom domains in Starter/free and Growth; final pricing
is undecided. New catalog bootstrap uses this policy. Deployment/reseeding do not
rewrite existing published versions or accepted subscriptions. For an existing
catalog, publish Included custom domains in Operations -> plan catalog while
preserving other terms. Use the tenant Subscription terms control to adopt the
new version of its current plan with a reason. Adoption is immediate/audited and
does not collect payment or change historical invoices. No paid upgrade is needed
for Starter. Never edit subscription history manually.

## 6. Merchant activation and acceptance

In Settings -> Domains, add each hostname separately. Publish the generated
persistent ownership TXT and point a subdomain CNAME to `domains.ecset.dev` with
the provider proxy disabled. Apex domains use ALIAS/ANAME/flattened CNAME or the
displayed IPv4 fallback. Follow readiness/CAA diagnostics and wait for activation;
do not force an active state in the database.

Verify HTTP redirects to HTTPS, a publicly trusted certificate covers the exact
hostname, and the domain serves the expected shop. HTTPS checks must work without
disabling certificate verification. Verify managed-host recovery, unknown-host/
private-path denial, removal and reconnect.

## Operations and disable behavior

Back up production `acme.json` securely as normal operational practice; never
delete it to repair issuance. Preserve Origin CA material and the long-lived
DNS target. Do not manually edit ECS-owned live route snapshots/checkpoints.

To disable, set `ECS_CUSTOM_DOMAINS_ENABLED=false` but retain overlay, worker,
route directory and backend until withdrawal is acknowledged. Removing those
resources first prevents normal cleanup. The switch controls infrastructure
availability, independently of plan entitlements.
