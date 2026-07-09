export {
  getStorefrontTemplates,
  getStorefrontDraft,
  updateStorefrontDraft,
  publishStorefrontDraft,
  selectStorefrontTemplate,
} from "@/lib/platform-api/storefront/templates";

export type {
  StorefrontTemplateCatalogResult,
  StorefrontTemplateSelectionResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
} from "@/lib/platform-api/storefront/templates";
