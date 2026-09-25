import { z } from "zod";

import { tenantStatusSchema } from "./tenant";

import {
  defaultStorefrontLanguageSettings,
  emptyStorefrontLocalizedContent,
  storefrontLanguageSettingsSchema,
  storefrontLocalizedContentSchema,
} from "./storefront-localization";

export const storefrontTemplateCatalogItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  previewAssetId: z.string().min(1).nullable().optional(),
  tags: z.unknown(),
  minimumPlanId: z.string().min(1).nullable(),
  version: z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    templateKey: z.string().min(1),
    previewData: z.unknown(),
    previewAssetId: z.string().min(1).nullable().optional(),
    previewAltText: z.string().min(1).nullable().optional(),
    previewUrl: z.string().url().nullable().optional(),
    demoUrl: z.string().url().nullable().optional(),
  }),
});

export const storefrontTemplateCatalogSchema = z.object({
  templates: z.array(storefrontTemplateCatalogItemSchema),
});

export type StorefrontTemplateCatalogItem = z.infer<typeof storefrontTemplateCatalogItemSchema>;

export const operatorStorefrontTemplateCatalogSchema = z.object({
  ok: z.literal(true),
  templates: z.array(
    z.object({
      description: z.string(),
      name: z.string(),
      slug: z.string(),
      status: z.string(),
      templateId: z.string().min(1),
      templateKey: z.string().min(1),
      version: z.number().int().positive(),
      versionId: z.string().min(1),
      previewAltText: z.string().nullable(),
      previewAssetId: z.string().nullable(),
      previewUrl: z.string().url().nullable(),
      demoUrl: z.string().url().nullable(),
      demoUrlOverride: z.string().url().nullable(),
    }),
  ),
});

export type OperatorStorefrontTemplateCatalog = z.infer<
  typeof operatorStorefrontTemplateCatalogSchema
>;

export const storefrontTemplateSelectionSchema = z.object({
  draft: z.object({
    tenantId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    source: z.enum(["clean", "saved"]),
    hasUnpublishedChanges: z.boolean(),
  }),
});

export type StorefrontTemplateSelection = z.infer<typeof storefrontTemplateSelectionSchema>;

export const storefrontSeoSettingsSchema = z.object({
  title: z.string().trim().max(70).nullable(),
  description: z.string().trim().max(160).nullable(),
  socialImageUrl: z.string().trim().url().max(2_000).nullable(),
});

export const storefrontDraftSchema = z.object({
  draft: z.object({
    tenantId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    data: z.unknown(),
    themeTokens: z.unknown(),
    seo: storefrontSeoSettingsSchema.optional(),
    languageSettings: storefrontLanguageSettingsSchema.default(defaultStorefrontLanguageSettings),
    localizedContent: storefrontLocalizedContentSchema.default(emptyStorefrontLocalizedContent),
    updatedAt: z.string().min(1),
    published: z
      .object({
        revisionId: z.string().min(1),
        publishedAt: z.string().min(1),
        templateKey: z.string().min(1),
        data: z.unknown(),
        themeTokens: z.unknown(),
        seo: storefrontSeoSettingsSchema.optional(),
        languageSettings: storefrontLanguageSettingsSchema.default(
          defaultStorefrontLanguageSettings,
        ),
        localizedContent: storefrontLocalizedContentSchema.default(emptyStorefrontLocalizedContent),
      })
      .nullable()
      .optional(),
  }),
});

export type StorefrontDraft = z.infer<typeof storefrontDraftSchema>;

export const storefrontPublishSchema = z.object({
  storefront: z.object({
    tenantId: z.string().min(1),
    publishedRevisionId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    publishedAt: z.string().min(1),
  }),
});

export type StorefrontPublish = z.infer<typeof storefrontPublishSchema>;

/** Response after pausing/unpublishing a shop (live storefront goes offline). */
export const storefrontUnpublishSchema = z.object({
  storefront: z.object({
    tenantId: z.string().min(1),
    isPublished: z.literal(false),
  }),
});

export type StorefrontUnpublish = z.infer<typeof storefrontUnpublishSchema>;

export const storefrontSeoSettingsResponseSchema = z.object({
  seo: storefrontSeoSettingsSchema,
});

export type StorefrontSeoSettings = z.infer<typeof storefrontSeoSettingsSchema>;

export const superadminTenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  ownerEmail: z.string().email().nullable(),
  status: tenantStatusSchema,
  primaryDomainHostname: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const superadminTenantListSchema = z.object({
  tenants: z.array(superadminTenantSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const superadminTenantDetailSchema = z.object({ tenant: superadminTenantSchema });
export type SuperadminTenant = z.infer<typeof superadminTenantSchema>;

export const publishedStorefrontConfigSchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    handle: z.string().min(1),
    status: tenantStatusSchema,
    domain: z.object({
      id: z.string().min(1),
      hostname: z.string().min(1),
    }),
    primaryDomain: z.object({
      hostname: z.string().min(1),
    }),
  }),
  commerce: z.object({
    regionId: z.string().min(1),
  }),
  storefront: z.object({
    publishedRevisionId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    data: z.unknown(),
    themeTokens: z.unknown(),
    languageSettings: storefrontLanguageSettingsSchema.default(defaultStorefrontLanguageSettings),
    localizedContent: storefrontLocalizedContentSchema.default(emptyStorefrontLocalizedContent),
    publishedAt: z.string().min(1).nullable(),
    seo: storefrontSeoSettingsSchema,
  }),
});

export type PublishedStorefrontConfig = z.infer<typeof publishedStorefrontConfigSchema>;

export const storefrontPreviewSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export type StorefrontPreviewSession = z.infer<typeof storefrontPreviewSessionSchema>;

export const merchantDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});
export type MerchantDeleteResult = z.infer<typeof merchantDeleteResultSchema>;

export const merchantBatchDeleteResultSchema = z.object({
  ids: z.array(z.string().min(1)),
  deleted: z.boolean(),
});
export type MerchantBatchDeleteResult = z.infer<typeof merchantBatchDeleteResultSchema>;
export * from "./insights";
