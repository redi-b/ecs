import type { Logger, MedusaContainer } from "@medusajs/framework/types";
import { QueryContext } from "@medusajs/framework/utils";

import {
  PRODUCT_SEARCH_FIELDS,
  type ProductSearchSource,
  toProductSearchDocument,
} from "./product-search-document";
import { MEILISEARCH_MODULE } from "../modules/meilisearch";
import type { ProductSearchProvider } from "../modules/meilisearch/types";

type QueryGraph = {
  graph(input: {
    entity: "product";
    fields: string[];
    pagination: { skip: number; take: number };
    context?: Record<string, unknown>;
  }): Promise<{ data: ProductSearchSource[] }>;
};

export async function reindexProductSearch(container: MedusaContainer) {
  const logger = container.resolve<Logger>("logger");
  const query = container.resolve<QueryGraph>("query");
  const search = container.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
  const batchSize = 500;
  const indexedIds: string[] = [];
  const reconciliationStartedAt = Date.now();

  await search.configureProductIndex();
  for (let offset = 0; ; offset += batchSize) {
    const { data } = await query.graph({
      entity: "product",
      fields: [...PRODUCT_SEARCH_FIELDS],
      pagination: { skip: offset, take: batchSize },
      context: {
        variants: { calculated_price: QueryContext({ currency_code: "etb" }) },
      },
    });
    if (!data.length) break;
    const documents = data.map(toProductSearchDocument);
    await search.upsertProducts(documents);
    indexedIds.push(...documents.map(({ id }) => id));
    if (data.length < batchSize) break;
  }

  const removed = await search.pruneProducts(indexedIds, reconciliationStartedAt);
  logger.info(`Product search reconciliation indexed ${indexedIds.length} and removed ${removed}.`);
  return { indexed: indexedIds.length, removed };
}
