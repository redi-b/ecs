# Product search operations

Meilisearch is a rebuildable product-search projection. Medusa and PostgreSQL remain the source of truth.

The product index also powers storefront category, collection, option, and ETB price filters. Option facets use structured option and value pairs so identical value labels under different options do not collide.

## Local setup

Start the infrastructure stack, then start the applications normally. The local Compose key and the Medusa development fallback key match, so no extra search configuration is required. `pnpm dev:apps` performs a blocking reconciliation before it starts the app processes, which prevents an empty local index from looking like a valid no-result search.

```sh
docker compose -f infra/compose/docker-compose.yml up -d meilisearch
pnpm --filter @ecs/medusa search:reindex
```

The index is also updated after product create, update, and delete workflows. A nightly Medusa job reconciles missed writes and stale documents.

## Search behavior

- Product title, subtitle, options, variants, category, collection, tags, description, handle, SKU, and barcode are indexed with deliberate ranking priority.
- Storefront search supports typo tolerance, live suggestions, accurate facet counts, product-option filters, ETB price ranges, and relevance, newest, price, and title ordering.
- Dashboard search keeps indexed relevance when category, collection, or product status filters are active.
- Displayed prices and inventory are always hydrated from Medusa. Search stores only each product's ETB price range for filtering and ordering, preferring contextual calculated prices and falling back to authoritative ETB variant prices when needed.
- Storefront search submissions and suggestion selections are recorded through the existing tenant analytics boundary.

## Production setup

Set a strong `MEILISEARCH_API_KEY`. Meilisearch is reachable only inside the Compose network and through its loopback-bound administration port. Browsers never receive the master key.

Dokploy runs `reindex-medusa-search` after Medusa migrations and before the Medusa API starts. The persistent `meilisearch-data` volume stores the index and daily snapshots.

## Failure behavior

- Product writes succeed if search synchronization fails.
- Storefront and dashboard product searches fall back to Medusa database search.
- Product records are hydrated from Medusa after ranking, so prices and inventory never come from the index.
- If advanced option or price filters are active during a search outage, the storefront shows a recoverable error instead of silently returning an incorrect unfiltered catalog.
- Run `pnpm --filter @ecs/medusa search:reindex` to repair or rebuild the projection.
- Slow provider searches above 250 ms are logged without recording the shopper's query.
- Index document counts are cached briefly in Medusa to avoid an extra statistics request for every keystroke while still detecting an empty index.
- Authenticated operators can check `GET /admin/product-search/health`; it returns `503` when Meilisearch or its index statistics are unavailable, and reports whether the index is populated.

## Verification

After starting `dev:infra` and `dev:apps`, confirm all of the following:

1. An exact product title returns the expected item in the dashboard and storefront.
2. A one-character typo in a word of at least four characters returns the same item.
3. A two-character typo in a word of at least eight characters returns a relevant item without broad unrelated matches.
4. Category and collection terms can find products, and combining a query with those filters stays relevant.
5. Storefront suggestions work with touch, mouse, Arrow Up/Down, Enter, and Escape.
6. Stopping Meilisearch preserves basic exact database search instead of breaking the catalog.
7. Multiple values under one option broaden results, while values from different option names narrow results.
8. Category, collection, option, and price filters show useful counts or bounds and remain in pagination URLs.
9. Relevance, newest, price, and title sorting preserve all active filters.

## Versioning

The product index defaults to `ecs_products_v1`. Change `MEILISEARCH_PRODUCT_INDEX_NAME` when a breaking document schema requires a parallel index rollout.
