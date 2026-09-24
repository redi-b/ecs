export type {
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogResult,
  StorefrontTemplateSelectionResult,
  StorefrontUnpublishResult,
} from "@/lib/platform-api/storefront/templates";
export {
  getStorefrontDraft,
  createStorefrontPreviewSession,
  getStorefrontTemplates,
  publishStorefrontDraft,
  selectStorefrontTemplate,
  unpublishStorefront,
  updateStorefrontDraft,
} from "@/lib/platform-api/storefront/templates";
