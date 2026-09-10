# Product search operations

Meilisearch is a rebuildable product-search projection. Medusa and PostgreSQL remain the source of truth.

## Local setup

Start the infrastructure stack, then start Medusa normally. The local Compose key and the Medusa development fallback key match, so no extra search configuration is required.

```sh
docker compose -f infra/compose/docker-compose.yml up -d meilisearch
pnpm --filter @ecs/medusa search:reindex
```

The index is also updated after product create, update, and delete workflows. A nightly Medusa job reconciles missed writes and stale documents.

## Production setup

Set a strong `MEILISEARCH_API_KEY`. Meilisearch is reachable only inside the Compose network and through its loopback-bound administration port. Browsers never receive the master key.

Dokploy runs `reindex-medusa-search` after Medusa migrations and before the Medusa API starts. The persistent `meilisearch-data` volume stores the index and daily snapshots.

## Failure behavior

- Product writes succeed if search synchronization fails.
- Storefront and dashboard product searches fall back to Medusa database search.
- Product records are hydrated from Medusa after ranking, so prices and inventory never come from the index.
- Run `pnpm --filter @ecs/medusa search:reindex` to repair or rebuild the projection.

## Versioning

The product index defaults to `ecs_products_v1`. Change `MEILISEARCH_PRODUCT_INDEX_NAME` when a breaking document schema requires a parallel index rollout.
