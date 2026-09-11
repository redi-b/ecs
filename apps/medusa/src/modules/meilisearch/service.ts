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
    "option_pairs",
    "variant_titles",
    "skus",
    "barcodes",
    "price_min_etb",
    "price_max_etb",
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
    "option_pairs",
    "price_min_etb",
    "price_max_etb",
  ],
  sortableAttributes: ["created_at", "updated_at", "title", "price_min_etb"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
  pagination: { maxTotalHits: 10_000 },
  faceting: { maxValuesPerFacet: 250 },
  searchCutoffMs: 200,
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

function optionPairGroup(value: string) {
  try {
    const pair: unknown = JSON.parse(value);
    return Array.isArray(pair) && typeof pair[0] === "string" ? pair[0] : value;
  } catch {
    return value;
  }
}

export function buildOptionPairFilters(pairs: string[]) {
  const groups = new Map<string, string[]>();
  for (const pair of pairs) {
    const group = optionPairGroup(pair);
    groups.set(group, [...(groups.get(group) ?? []), pair]);
  }
  return [...groups.values()].map((values) =>
    `(${values.map((pair) => `option_pairs = ${filterValue(pair)}`).join(" OR ")})`,
  );
}

export default class MeilisearchModuleService implements ProductSearchProvider {
  private readonly client: Meilisearch;
  private readonly indexName: string;
  private readonly logger: Logger;
  private configurePromise: Promise<void> | undefined;
  private documentCountCache: { expiresAt: number; value: number } | undefined;
  private documentCountPromise: Promise<number> | undefined;

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
    this.documentCountCache = undefined;
  }

  async deleteProducts(ids: string[]) {
    if (!ids.length) return;
    await this.client.index(this.indexName).deleteDocuments(ids).waitTask();
    this.documentCountCache = undefined;
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
    if (stale.length) this.documentCountCache = undefined;
    return stale.length;
  }

  private async getDocumentCount() {
    const now = Date.now();
    if (this.documentCountCache && this.documentCountCache.expiresAt > now) {
      return this.documentCountCache.value;
    }
    this.documentCountPromise ??= this.client
      .index(this.indexName)
      .getStats()
      .then((stats) => {
        this.documentCountCache = {
          expiresAt: Date.now() + 10_000,
          value: stats.numberOfDocuments,
        };
        return stats.numberOfDocuments;
      })
      .finally(() => {
        this.documentCountPromise = undefined;
      });
    return this.documentCountPromise;
  }

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult> {
    await this.configureProductIndex();
    const channelFilter = query.salesChannelIds
      .map((id) => `sales_channel_ids = ${filterValue(id)}`)
      .join(" OR ");
    const filters = [`(${channelFilter})`];
    if (!query.includeDrafts) filters.push(`status = "published"`);
    if (query.statuses?.length) {
      filters.push(
        `(${query.statuses.map((status) => `status = ${filterValue(status)}`).join(" OR ")})`,
      );
    }
    if (query.categoryIds?.length) {
      filters.push(
        `(${query.categoryIds
          .map((id) => `category_ids = ${filterValue(id)}`)
          .join(" OR ")})`,
      );
    }
    if (query.collectionId) {
      filters.push(`collection_id = ${filterValue(query.collectionId)}`);
    }
    if (query.optionPairs?.length) {
      filters.push(...buildOptionPairFilters(query.optionPairs));
    }
    if (query.priceMinEtb !== undefined) filters.push(`price_min_etb >= ${query.priceMinEtb}`);
    if (query.priceMaxEtb !== undefined) filters.push(`price_min_etb <= ${query.priceMaxEtb}`);

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
    const [result, indexDocumentCount] = await Promise.all([
      index.search(query.q, params),
      this.getDocumentCount(),
    ]);
    if (result.processingTimeMs >= 250) {
      this.logger.warn(
        `Product search exceeded latency budget (${result.processingTimeMs}ms, ${result.estimatedTotalHits ?? result.hits.length} hits).`,
      );
    }

    return {
      ...(result.facetDistribution ? { facetDistribution: result.facetDistribution } : {}),
      ...(result.facetStats ? { facetStats: result.facetStats } : {}),
      hits: result.hits,
      indexDocumentCount,
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

  async status() {
    const available = await this.health();
    if (!available) return { available: false, documentCount: null };
    try {
      return { available: true, documentCount: await this.getDocumentCount() };
    } catch (error) {
      this.logger.warn(`Meilisearch index status check failed: ${String(error)}`);
      return { available: true, documentCount: null };
    }
  }
}
