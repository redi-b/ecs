# Operations

How ECS is built, released, and run.

Images are built in CI, pushed to the container registry, and pulled onto the host. Caddy routes by `Host` and path. Data services are not published on the public internet.

Applications are configured with URLs (`PLATFORM_DATABASE_URL`, `REDIS_URL`, `MEDIA_S3_*`). Changing where Postgres, Redis, or object storage run does not require changing application code, provided TLS and credentials are set.

## Local and production Compose

Local Compose (`infra/compose`) publishes database and storage ports so apps can run on the host. Production Compose does not publish those ports. Do not copy local port mappings into production.

## Releases

Application images target `linux/amd64`.

Registry tags include `sha-<git-sha>` and the branch name. Releases that serve merchants use the SHA tag.

Rollback: set every application service to the previous SHA and redeploy them together. If that release applied a destructive migration, restore databases and media instead of reversing the migration by hand.

## Backups

restic encrypts and versions snapshots. The repository must be off the application host.

Hourly backups include `platform_db` and `medusa_db` from the same window, plus object storage (media). Redis sessions and storefront HTML cache are rebuilt. The search index is rebuilt from the commerce engine. Job run history lives in the platform database.

Scripts: `infra/dokploy/backup.sh` and `restore.sh`. Restore requires `CONFIRM=yes`. Acceptance checks are in `infra/dokploy/OPERATIONS.md`.

## DNS and TLS

Shop hostnames are `{handle}.{BASE_DOMAIN}` (one label). A wildcard certificate cannot be issued with HTTP-01; DNS-01 or an edge that already covers `*.BASE_DOMAIN` is required. Nested names such as `preview.shop.{base}` are not covered by a single-level wildcard.

## Observability

Probe the public path from outside the host (sign-in, `GET /health`, a shop `/healthz`, a media object). Alert if the backup job misses a ping. Rotate Docker json-file logs (`max-size` / `max-file` on the Compose services). Host CPU, memory, and disk need an agent or provider graphs.

## Email, Telegram, search

Transactional email uses `EMAIL_PROVIDER` (Resend is the installed adapter). Telegram webhooks require `TELEGRAM_WEBHOOK_SECRET` when the bot is enabled. Search: [Product search](./operations/meilisearch.md).
