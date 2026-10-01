# Managed custom-domain ingress

Follow the [production deployment checklist](DEPLOYMENT.md).

This is the production custom-domain add-on for the ECS deployment. It is not
needed for ordinary local development. Keep `ECS_CUSTOM_DOMAINS_ENABLED=false`
until the route directory, backend file, Compose add-on, DNS target and normal
ECS deployment have been prepared and health-checked. Then enable it and activate
merchant hostnames from Dashboard → Settings → Domains.

## What the files are

These files have different jobs:

- `infra/dokploy/custom-domains.compose.yml` is the **Compose add-on**. Dokploy
  merges it with `infra/dokploy/docker-compose.yml`; it adds the gateway, private
  Traefik network, and API/worker route-directory mount. It stays in
  `infra/dokploy/` because it is a Compose file merged beside the base Compose
  file.
- `infra/dokploy/custom-domains/Caddyfile` is mounted into the gateway container
  by that add-on. It forwards storefront traffic only and rejects dashboard,
  auth and platform paths.
- `infra/dokploy/custom-domains/backend.yml` is installed once on the VPS into
  Traefik's dynamic directory. It defines the stable file-provider backend that
  points Traefik at the gateway. It is not a second Compose file and is not
  copied into the application container.
- `DEPLOYMENT.md` contains the production operator procedure; this README
  explains the architecture and boundaries.

## Boundaries

- Traefik owns HTTP redirects, TLS termination, ACME HTTP-01 and renewal.
- ECS publishes exact authorized host routers. It does not write certificates,
  read ACME accounts or mount the Docker socket.
- Only `/etc/dokploy/traefik/dynamic/ecs-custom-domains` is writable from ECS.
  Never mount the entire dynamic directory into application containers.
- The Traefik API is reached internally at `http://dokploy-traefik:8080`.
  Do not publish that port, proxy it through a merchant domain, or expose the
  insecure API publicly. Confirm firewall and published-port configuration.
- The gateway has no published ports and Docker discovery is disabled. It
  forwards the original Host to the storefront and rejects platform/admin/auth
  paths. Normal storefront access still requires tenant/domain admission.
- Joining `dokploy-network` grants the API and worker network reachability to
  other services on that network. It does not grant a Docker socket or host
  filesystem access. Restrict that network to trusted deployment services.

## One-time VPS preparation

Run this once on the Dokploy host before the first production deployment.
From the repository checkout on the VPS, as an operator with host permissions:

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
install -m 0644 infra/dokploy/custom-domains/backend.yml \
  /etc/dokploy/traefik/dynamic/ecs-custom-domains-backend.yml
```

The guarded command stops if an existing backend file is found; compare that
file rather than overwriting unrelated configuration. The route directory must remain present
across deployments. ECS's publisher synchronizes files and notifies the watched
parent by updating its owned directory timestamp: Traefik 3.6.25 reads nested
configuration but does not register recursive directory watches.

The host ownership is derived from the running API image rather than assuming a
permanent UID/GID. The current image reports `node` as `1000:1000`; if a future
image changes that identity, rerun the preparation command after deployment.

ECS also keeps a hash-only publication journal in this owned directory. After a
worker interruption it validates the journal and republishes current authorized
routes, not an old checkpoint that might contain a removed hostname. Unknown
or externally changed snapshots stop for operator review. Do not delete the
journal/checkpoint as a routine repair or manually edit ECS-owned live files.

Set these Dokploy environment values:

```dotenv
ECS_CUSTOM_DOMAINS_ENABLED=false
ECS_DOMAIN_ROUTE_HOST_DIRECTORY=/etc/dokploy/traefik/dynamic/ecs-custom-domains
ECS_DOMAIN_INGRESS_IPV4=YOUR_PUBLIC_INGRESS_IPV4
ECS_DOMAIN_CERT_RESOLVER=letsencrypt
```

The overlay supplies `ECS_DOMAIN_ROUTE_DIRECTORY=/var/lib/ecs-domain-routes`,
`ECS_DOMAIN_TRAEFIK_API_URL=http://dokploy-traefik:8080`, and
`ECS_DOMAIN_STOREFRONT_SERVICE=ecs-custom-domains-storefront@file` to both API and
worker. Only the ingress IPv4 and host mount path are operator inputs. The flag
controls routing availability, not billing entitlement. If an older deployment
still has `ECS_CUSTOM_DOMAINS_BETA`, remove it; only `ECS_CUSTOM_DOMAINS_ENABLED`
is read.

Keep `domains.ecset.dev` DNS-only and directed at that ingress address. Do not
add an AAAA record unless ECS explicitly supports and validates the IPv6 ingress.
Back up production `acme.json` securely using the existing operator procedure;
never remove it as a certificate repair. Keep the managed-platform Cloudflare
Origin CA configuration separate.

## Enable the overlay in Dokploy

Keep the ordinary Compose Path. In the Compose advanced custom Command, merge
the overlay after the base file, preserving the **existing Dokploy project name**:

```text
compose -p <existing-dokploy-app-name> -f infra/dokploy/docker-compose.yml -f infra/dokploy/custom-domains.compose.yml up -d
```

Dokploy prepends `docker`. Use the exact existing application/project name, not
a new name: changing it would create a second stack. Paths are relative to the
repository checkout; bind paths inside the overlay are resolved relative to
the first Compose file. Do not add merchant domains through Dokploy's Domains UI:
the ECS file-provider reconciler owns their exact routers.

Validate without starting containers:

```sh
docker compose --env-file infra/dokploy/.env.example \
  -f infra/dokploy/docker-compose.yml \
  -f infra/dokploy/custom-domains.compose.yml config --quiet
```

Provide the required domain environment values when validating. Confirm the
installed Dokploy command/path behavior during deployment; the configuration
regression is not proof of a successful remote deployment.

## Activation and disable behavior

Production uses the `letsencrypt` HTTP-01 resolver. Publicly trusted certificates
and expected-shop HTTPS checks are required for activation.

After the application is deployed, confirm the intended shop has
custom-domain access. The current policy includes domains in Starter/free and Growth;
existing subscriptions need explicit adoption of updated published terms through
Operations. Final plan/pricing structure is undecided. See the deployment runbook.
Each hostname requires its own persistent ownership TXT and
DNS verification; ECS marks active only after public HTTPS/SNI and expected-shop
identity checks pass. Keep the managed shop hostname available for recovery.

Initial ownership challenges expire after seven days. Repeating an expired
unverified claim creates a fresh challenge on the same domain; already verified
ownership challenges remain persistent and must stay in DNS while connected.
Settings diagnostics contain the last completed readiness check and bounded
reason codes, including restrictive CAA. Temporary lookup failures do not count
as confirmed DNS breakage. Confirmed accidental DNS/TXT breakage starts the
documented seven-day warning period; explicit removal has no admission grace.

### Merchant setup and acceptance

In the intended shop's dashboard, open **Settings → Domains**. Add each exact
hostname separately and copy its generated TXT name/value to the merchant's DNS
provider. Keep that TXT record while connected. For a subdomain, point the CNAME
to the published ECS target with the provider proxy disabled. Apex hosts use
ALIAS/ANAME/flattened CNAME, or the displayed IPv4 fallback with its migration
warning. DNS changes can take time; an ownership recheck is not an HTTPS
activation override.

The page shows readiness, safe CAA guidance and last-check timestamps. It offers
Open and Make primary only for a ready address. The managed ECS hostname remains
available and can be made primary again. A removal confirmation explains the
storefront impact; accepted-but-pending withdrawal remains visible until ECS
confirms removal. Failed list loads show retry rather than an empty domain list.

For release acceptance, confirm a publicly trusted certificate for the exact
hostname and the expected shop's storefront, managed-host recovery, unknown-host
denial, and explicit removal/withdrawal. Preserve production ACME storage and
the long-lived ECS DNS target.

Removal denies storefront admission first. Its hostname and shop slot are
released only after Traefik confirms the routing withdrawal. Historical domain
identities, ownership challenges, lifecycle events and audit records remain;
reconnecting uses a new identity and new TXT challenge. If publication fails,
leave the worker and owned route directory intact for scheduled repair.

To disable, keep the overlay and worker running, set the flag false, and wait
for the empty route snapshot to be acknowledged. Removing the mount/network
configuration first prevents ECS from withdrawing existing routes. For a stuck
provider, storefront admission remains denied but operator route repair may
still be required. Do not delete the shared ACME store or unrelated routes.

## Regression evidence

```sh
node --test scripts/custom-domain-deployment.test.mjs
ECS_DOMAIN_DOCKER_TEST=1 node --import tsx --test scripts/custom-domain-routing.docker.test.mjs
```

The first uses Docker Compose's actual parser without starting containers. The
second uses isolated pinned Traefik and Caddy containers, loopback-only ports
and an unreachable test CA; it never requests a public certificate.

References:
- [Dokploy Docker Compose commands](https://docs.dokploy.com/docs/core/docker-compose)
- [Docker multiple Compose files](https://docs.docker.com/reference/cli/docker/compose/)
- [Traefik 3.6.25 file-provider source](https://github.com/traefik/traefik/blob/v3.6.25/pkg/provider/file/file.go)
