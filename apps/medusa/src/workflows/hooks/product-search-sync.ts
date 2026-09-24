import type { Logger } from "@medusajs/framework/types";
import { QueryContext } from "@medusajs/framework/utils";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows";

import {
  PRODUCT_SEARCH_FIELDS,
  PRODUCT_SEARCH_LOCALES,
  type ProductSearchSource,
  toProductSearchDocument,
} from "../../lib/product-search-document";
import { MEILISEARCH_MODULE } from "../../modules/meilisearch";
import type { ProductSearchProvider } from "../../modules/meilisearch/types";

type WorkflowContainer = { resolve: <T = unknown>(key: string) => T };
type ProductQuery = {
  graph(input: {
    entity: "product";
    fields: string[];
    filters: { id: string[] };
    context?: Record<string, unknown>;
  }, options?: { locale?: string }): Promise<{ data: ProductSearchSource[] }>;
};

async function retrySearchWrite(operation: () => Promise<void>) {
  const delays = [0, 100, 300];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function indexProducts(ids: string[], container: WorkflowContainer) {
  const logger = container.resolve<Logger>("logger");
  try {
    const query = container.resolve<ProductQuery>("query");
    const search = container.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
    const localized = await Promise.all(PRODUCT_SEARCH_LOCALES.map(async (locale) => {
      const { data } = await query.graph({
        entity: "product",
        fields: [...PRODUCT_SEARCH_FIELDS],
        filters: { id: ids },
        context: {
          variants: { calculated_price: QueryContext({ currency_code: "etb" }) },
        },
      }, { locale });
      return data.map((product) => toProductSearchDocument(product, locale));
    }));
    await retrySearchWrite(() => search.upsertProducts(localized.flat()));
  } catch (error) {
    // Search is an eventually-consistent projection. A temporary outage must
    // never roll back a product mutation; reconciliation repairs missed writes.
    logger.error(`Could not synchronize product search documents: ${String(error)}`);
  }
  return new StepResponse({ attempted: ids.length });
}

deleteProductsWorkflow.hooks.productsDeleted(async ({ ids }, { container }) => {
  const logger = container.resolve<Logger>("logger");
  try {
    const search = container.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
    await retrySearchWrite(() => search.deleteProducts(ids));
  } catch (error) {
    logger.error(`Could not delete product search documents: ${String(error)}`);
  }
  return new StepResponse({ attempted: ids.length });
});
