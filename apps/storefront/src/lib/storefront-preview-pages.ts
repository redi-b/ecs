import { loadHomePageModel } from "./home-page.js";
import { listStoreCategories, listStoreCollections } from "./commerce/catalog.js";
import { listStoreProducts } from "./commerce/products.js";
import { isStoreError } from "./commerce/result.js";
import type { PageContext } from "./page-context.js";
import { getStorefrontRenderer } from "../templates/registry.js";
import type { StorefrontPageComponent, StorefrontRenderer } from "../templates/types.js";
import type { StorefrontPreviewPageId } from "./storefront-preview-page-contract.js";

type PreviewPage = {
  component: StorefrontPageComponent;
  props: Record<string, unknown>;
};

type ReadyPageContext = Extract<PageContext, { ok: true }>;

type PreviewPageDescriptor = {
  id: StorefrontPreviewPageId;
  rendererSlot: keyof StorefrontRenderer;
  load: (context: ReadyPageContext) => Promise<Record<string, unknown>>;
};

const previewPages: Record<StorefrontPreviewPageId, PreviewPageDescriptor> = {
  home: {
    id: "home",
    rendererSlot: "Home",
    load: async (context) => {
      const model = await loadHomePageModel(context, { includeCatalogFallback: true });
      return {
        productsResult: model?.productsResult ?? { products: [] },
        collectionProducts: model?.collectionProducts ?? [],
        collections: model?.collections ?? [],
      };
    },
  },
  products: {
    id: "products",
    rendererSlot: "ProductList",
    load: async (context) => {
      const [productsResult, collectionsResult, categoriesResult] = await Promise.all([
        listStoreProducts({
          platformApiBaseUrl: context.platformApiBaseUrl,
          requestHost: context.requestHost,
          regionId: context.config.commerce.regionId,
          limit: 24,
          offset: 0,
          q: null,
          collectionId: null,
          categoryId: null,
          order: null,
        }),
        listStoreCollections({
          platformApiBaseUrl: context.platformApiBaseUrl,
          requestHost: context.requestHost,
          limit: 50,
        }),
        listStoreCategories({
          platformApiBaseUrl: context.platformApiBaseUrl,
          requestHost: context.requestHost,
          limit: 100,
        }),
      ]);
      const products = isStoreError(productsResult) ? [] : productsResult.products;
      return {
        products,
        errorMessage: isStoreError(productsResult) ? productsResult.message : null,
        hasPrev: false,
        hasNext: !isStoreError(productsResult) && products.length < (productsResult.count ?? products.length),
        nextHref: "/products?offset=24",
        collections: isStoreError(collectionsResult) ? [] : collectionsResult.collections,
        categories: isStoreError(categoriesResult) ? [] : categoriesResult.categories,
        filters: {},
        totalCount: isStoreError(productsResult) ? 0 : (productsResult.count ?? products.length),
        offset: 0,
        limit: 24,
      };
    },
  },
};

export async function loadStorefrontPreviewPage(
  context: ReadyPageContext,
  pageId: StorefrontPreviewPageId,
): Promise<PreviewPage | null> {
  const descriptor = previewPages[pageId];
  const renderer = getStorefrontRenderer(context.config.storefront.templateKey);
  const component = renderer?.[descriptor.rendererSlot];
  if (!component) return null;

  return {
    component,
    props: await descriptor.load(context),
  };
}
