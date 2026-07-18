export type StorefrontTemplateCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  previewAssetId: string | null;
  tags: unknown;
  minimumPlanId: string | null;
  version: {
    id: string;
    version: number;
    templateKey: string;
    previewData: unknown;
  };
};

export type StorefrontTemplateSelectionResult =
  | {
      ok: true;
      draft: {
        tenantId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
      };
    }
  | {
      ok: false;
      error: "template_not_found" | "tenant_not_found" | "template_plan_unavailable";
    };

export type StorefrontDraftResult =
  | {
      ok: true;
      draft: {
        tenantId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
        updatedAt: string;
        published?: {
          revisionId: string;
          publishedAt: string;
          data: unknown;
          themeTokens: unknown;
        } | null;
      };
    }
  | {
      ok: false;
      error: "invalid_storefront_draft" | "storefront_draft_not_found";
    };

export type StorefrontDraftUpdateResult = StorefrontDraftResult;

export type StorefrontPublishResult =
  | {
      ok: true;
      storefront: {
        tenantId: string;
        publishedRevisionId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        publishedAt: string;
      };
    }
  | {
      ok: false;
      error: "invalid_storefront_draft" | "storefront_draft_not_found";
    };

export type StorefrontUnpublishResult =
  | {
      ok: true;
      storefront: {
        tenantId: string;
        isPublished: false;
      };
    }
  | {
      ok: false;
      error: "storefront_draft_not_found";
    };

export type PublishedStorefrontConfigResult =
  | {
      ok: true;
      config: {
        publishedRevisionId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
        publishedAt: string | null;
      };
    }
  | {
      ok: false;
      error: "published_revision_not_found";
    };
