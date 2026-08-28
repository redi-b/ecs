# ECS production operations

This runbook is for the operator responsible for an ECS Dokploy deployment. It covers the minimum
release, backup, restore, and rollback controls needed before serving merchants. Keep credentials,
backup locations, and incident details outside the repository.

## Release gate

1. Select a published immutable image tag (`sha-<git-sha>`) and record the previous known-good tag.
2. Validate the private production environment:

   ```sh
   pnpm validate:production-env -- /absolute/path/to/production.env
   ```

3. Confirm a recent off-host backup exists for Postgres and SeaweedFS. Preserve Redis AOF data when
   queued notifications or jobs must survive a host loss.
4. Deploy. Both migration jobs must complete successfully before application containers start.
5. Verify container health, then exercise the checks under “Post-deploy verification.”

Do not run demo seeds in production. Do not continue a release after either migration job fails.

## Public host configuration

Keep these public host values in the Dokploy environment and under the same delegated base domain:

```dotenv
BASE_DOMAIN=ecs.example.et
SUPERADMIN_PUBLIC_BASE_URL=https://ops.ecs.example.et
STOREFRONT_DEMO_HOST=demo.ecs.example.et
SUPERADMIN_AUTH_COOKIE_PREFIX=ecs-ops
```

Replace the example domain with the deployment's real base domain. The production validator rejects
an Operations URL or demo host that drifts outside it. Compose also derives the same `ops` and `demo`
hosts from `BASE_DOMAIN`, so the Dashboard can direct operators to the correct console and the
Storefront can resolve branded template demos at runtime. Keep the Operations cookie prefix distinct
from the merchant prefix.

DNS and TLS must cover `dashboard`, `ops`, `api`, `shop`, `media`, `demo`, and the managed shop
wildcard under the base domain before those public routes are accepted for testing.

## Initial operator access

Platform authority is never inferred from merchant membership. Bootstrap the first operator only
after application migrations complete and before relying on `https://ops.<base-domain>`.

1. Create or identify two different active ECS users: the operator receiving access and a second
   person confirming the grant. Record their immutable user IDs through the approved database
   administration channel; do not put emails or credentials in shell history.
2. Review the smallest permission set needed. The complete current operations workspace uses:

   ```text
   tenants.read,tenants.operations.read,tenants.diagnostics.read,tenants.status.update,tenants.support.read,tenants.support.note.create,tenants.support.access.manage,billing.entitlements.update
   ```

3. Run the transactional bootstrap from the exact immutable Platform image. Add a reviewed future
   ISO timestamp with `--expires-at` when the access is temporary:

   ```sh
   docker compose --env-file /absolute/path/to/production.env \
     -f infra/dokploy/docker-compose.yml run --rm --entrypoint node platform-api \
     --import tsx src/scripts/platform-access-bootstrap.ts \
     --user-id <operator-user-id> \
     --confirmed-by-user-id <different-confirmer-user-id> \
     --permissions tenants.read,tenants.operations.read,tenants.diagnostics.read,tenants.status.update,tenants.support.read,tenants.support.note.create,tenants.support.access.manage,billing.entitlements.update \
     --confirm-bootstrap
   ```

4. Retain the outcome in the restricted release record. The transaction activates the platform
   principal, grants only allowlisted permissions, and writes `platform.permissions_bootstrapped`
   with the confirmer identity.
5. Sign in at `https://ops.<base-domain>`. Verify the merchant directory loads, an ungranted command
   remains unavailable, and the audit event exists. Revoke or expire temporary bootstrap authority
   after the normal principal-administration workflow takes ownership.

The command rejects unknown permissions, inactive or missing users, expired timestamps, missing
confirmation, and attempts where the target confirms their own authority.

## Backup policy

Back up these stateful volumes or their logical equivalents:

| State | Required backup | Notes |
| --- | --- | --- |
| Postgres | Encrypted logical dumps of `platform_db` and `medusa_db` | Keep both from the same backup window. |
| SeaweedFS | Encrypted volume snapshot or verified S3-compatible object copy | Includes merchant media and product imagery. |
| Redis | AOF/volume snapshot when queued work must survive | Sessions can expire naturally, but queued jobs may be business-relevant. |

Store backups off the deployment host with restricted access. Define retention and recovery-point
objectives before launch; the repository deliberately does not invent business-specific retention
periods. At least monthly, restore the newest backup into an isolated environment and record the
result, duration, row/object counts, and any corrective action.

## Restore drill

A restore is successful only when all of the following are true:

- Platform and Medusa databases restore from the same backup window and migrations complete.
- A known merchant can sign in and access only its own tenant.
- Catalog counts and a sampled order agree with the backup record.
- Sampled media objects load through the storefront media origin.
- Cart creation, cash-on-delivery checkout, and order confirmation complete.
- The worker connects to Redis and scheduled billing jobs are registered exactly once.

Perform production restores during an announced maintenance window. Stop write-producing application
and worker containers before replacing state, retain the failed state until verification succeeds,
and never restore over the only copy of a database or media volume.

## Post-deploy verification

Verify, in order:

1. Platform API, Medusa, Dashboard, Superadmin, Storefront, Caddy, Postgres, Redis, and SeaweedFS are healthy.
2. `https://api.<base-domain>/health` and `https://shop.<base-domain>/healthz` return success.
3. Merchant sign-in, shop selection, catalog read, and a safe non-destructive settings read work.
4. A tenant storefront completes catalog → product → cart → checkout → confirmation using cash on
   delivery. Test Chapa separately only when production credentials and callback reachability are
   configured.
5. A media upload succeeds from the Dashboard origin and the resulting public object loads.
6. Dashboard HTML is not year-cached, while hashed `/_next/static/` assets are immutable-cached.
7. Worker logs show one billing reconciliation schedule and one lifecycle schedule, without a retry
   storm or repeated provider failures.
8. `https://ops.<base-domain>/sign-in` returns private, non-frameable HTML on the ops hostname and
   returns 404 when the same application is reached with a merchant or lookalike host.

## Rollback

Application rollback means changing all ECS application services to the recorded previous
`sha-<git-sha>` image tag and redeploying them together. Do not roll back application images across a
destructive or incompatible database migration. If a release changed data incompatibly, use the
tested restore procedure and its maintenance window instead of attempting an ad hoc down migration.

The managed `*.BASE_DOMAIN` storefront remains the customer-access fallback during custom-domain
incidents. Arbitrary merchant domains must not become primary until ownership, routing, and
certificate readiness are all confirmed by the selected production edge provider.
