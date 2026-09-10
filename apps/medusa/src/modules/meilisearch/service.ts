import type { Logger } from "@medusajs/framework/types";
import { Meilisearch, type SearchParams, type Settings } from "meilisearch";

import type {
  MeilisearchModuleOptions,
  ProductSearchDocument,
  ProductSearchProvider,
  ProductSearchQuery,
  ProductSearchResult,
} from "./types";

const PRODUCT_INDEX_SETTINGS = {
  displayedAttributes: [
    "id",
    "title",
    "subtitle",
    "description",
    "handle",
    "thumbnail",
    "status",
    "sales_channel_ids",
    "category_ids",
    "category_names",
    "collection_id",
    "collection_title",
    "tag_values",
    "option_values",
    "variant_titles",
    "skus",
    "barcodes",
    "created_at",
    "updated_at",
  ],
  searchableAttributes: [
    "title",
    "subtitle",
    "variant_titles",
    "option_values",
    "category_names",
    "collection_title",
    "tag_values",
    "description",
    "handle",
    "skus",
    "barcodes",
  ],
  filterableAttributes: [
    "sales_channel_ids",
    "status",
    "category_ids",
    "collection_id",
    "tag_values",
  ],
  sortableAttributes: ["created_at", "updated_at", "title"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
  typoTolerance: {
    enabled: true,
    disableOnAttributes: ["id", "handle", "skus", "barcodes"],
    disableOnNumbers: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
  },
} satisfies Settings;

function filterValue(value: string) {
  return JSON.stringify(value);
}

export default class MeilisearchModuleService implements ProductSearchProvider {
  private readonly client: Meilisearch;
  private readonly indexName: string;
  private readonly logger: Logger;
  private configurePromise: Promise<void> | undefined;

  constructor({ logger }: { logger: Logger }, options: MeilisearchModuleOptions) {
    this.logger = logger;
    this.indexName = options.productIndexName;
    this.client = new Meilisearch({
      host: options.host,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    });
  }

  async configureProductIndex() {
    this.configurePromise ??= this.client
      .index<ProductSearchDocument>(this.indexName)
      .updateSettings(PRODUCT_INDEX_SETTINGS)
      .waitTask()
      .then(() => undefined)
      .catch((error) => {
        this.configurePromise = undefined;
        throw error;
      });
    await this.configurePromise;
  }

  async upsertProducts(documents: ProductSearchDocument[]) {
    if (!documents.length) return;
    await this.configureProductIndex();
    await this.client
      .index<ProductSearchDocument>(this.indexName)
      .addDocuments(documents, { primaryKey: "id" })
      .waitTask();
  }

  async deleteProducts(ids: string[]) {
    if (!ids.length) return;
    await this.client.index(this.indexName).deleteDocuments(ids).waitTask();
  }

  async pruneProducts(validIds: string[], protectUpdatedAfter: number) {
    await this.configureProductIndex();
    const valid = new Set(validIds);
    const stale: string[] = [];
    const index = this.client.index<ProductSearchDocument>(this.indexName);
    const batchSize = 1_000;
    let offset = 0;
    while (true) {
      const page = await index.getDocuments<Pick<ProductSearchDocument, "id" | "updated_at">>({
        fields: ["id", "updated_at"],
        limit: batchSize,
        offset,
      });
      stale.push(
        ...page.results
          .filter(({ id, updated_at }) => !valid.has(id) && updated_at <= protectUpdatedAfter)
          .map(({ id }) => id),
      );
      offset += page.results.length;
      if (offset >= page.total || page.results.length === 0) break;
    }
    if (stale.length) await index.deleteDocuments(stale).waitTask();
    return stale.length;
  }

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult> {
    await this.configureProductIndex();
    const channelFilter = query.salesChannelIds
      .map((id) => `sales_channel_ids = ${filterValue(id)}`)
      .join(" OR ");
    const filters = [`(${channelFilter})`];
    if (!query.includeDrafts) filters.push(`status = "published"`);

    const params: SearchParams = {
      filter: filters,
      ...(query.attributesToHighlight
        ? { attributesToHighlight: query.attributesToHighlight }
        : {}),
      ...(query.facets ? { facets: query.facets } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.offset !== undefined ? { offset: query.offset } : {}),
      ...(query.sort ? { sort: query.sort } : {}),
    };
    const index = this.client.index<ProductSearchDocument>(this.indexName);
    const [result, stats] = await Promise.all([index.search(query.q, params), index.getStats()]);

    return {
      hits: result.hits,
      indexDocumentCount: stats.numberOfDocuments,
      estimatedTotalHits: result.estimatedTotalHits ?? result.hits.length,
      processingTimeMs: result.processingTimeMs,
      query: result.query,
    };
  }

  async health() {
    try {
      return (await this.client.health()).status === "available";
    } catch (error) {
      this.logger.warn(`Meilisearch health check failed: ${String(error)}`);
      return false;
    }
  }
}
