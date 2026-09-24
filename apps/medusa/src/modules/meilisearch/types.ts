import type { SearchParams } from "meilisearch";

export type ProductSearchDocument = {
  id: string;
  product_id: string;
  locale: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  handle: string;
  thumbnail: string | null;
  status: string;
  sales_channel_ids: string[];
  category_ids: string[];
  category_names: string[];
  collection_id: string | null;
  collection_title: string | null;
  tag_values: string[];
  option_values: string[];
  option_pairs: string[];
  variant_titles: string[];
  skus: string[];
  barcodes: string[];
  price_min_etb: number | null;
  price_max_etb: number | null;
  created_at: number;
  updated_at: number;
};

export type ProductSearchQuery = Pick<
  SearchParams,
  "attributesToHighlight" | "facets" | "limit" | "offset" | "sort"
> & {
  q: string;
  locale: string;
  salesChannelIds: string[];
  categoryIds?: string[];
  collectionId?: string;
  optionPairs?: string[];
  priceMinEtb?: number;
  priceMaxEtb?: number;
  includeDrafts?: boolean;
  statuses?: string[];
};

export type ProductSearchResult = {
  facetDistribution?: Record<string, Record<string, number>>;
  facetStats?: Record<string, { min: number; max: number }>;
  hits: ProductSearchDocument[];
  indexDocumentCount: number;
  estimatedTotalHits: number;
  processingTimeMs: number;
  query: string;
};

export type ProductSearchStatus = {
  available: boolean;
  documentCount: number | null;
};

export type MeilisearchModuleOptions = {
  apiKey?: string;
  host: string;
  productIndexName: string;
};

/** Stable boundary used by workflows and routes, independent of Meilisearch's client API. */
export interface ProductSearchProvider {
  configureProductIndex(): Promise<void>;
  deleteProducts(ids: string[]): Promise<void>;
  health(): Promise<boolean>;
  status(): Promise<ProductSearchStatus>;
  pruneProducts(validIds: string[], protectUpdatedAfter: number): Promise<number>;
  searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult>;
  upsertProducts(documents: ProductSearchDocument[]): Promise<void>;
}
