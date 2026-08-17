import { loadHomePageModel } from "./home-page.js";
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
