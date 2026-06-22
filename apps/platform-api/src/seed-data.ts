import { z } from "zod";

type StorefrontTemplateSeedSource = {
  slug: string;
  name: string;
  description: string;
  version: number;
  templateKey: string;
  schema: z.ZodType;
  defaultData: unknown;
  defaultThemeTokens: unknown;
};

export type PlatformSeedOptions = {
  storefrontBaseDomain: string;
  medusaPublishableKeyId: string;
  templates: readonly StorefrontTemplateSeedSource[];
};

export type PlatformSeed = ReturnType<typeof buildPlatformSeed>;

const localIds = {
  tenant: "00000000-0000-4000-8000-000000000001",
  domain: "00000000-0000-4000-8000-000000000002",
  template: "00000000-0000-4000-8000-000000000003",
  templateVersion: "00000000-0000-4000-8000-000000000004",
  storefrontRevision: "00000000-0000-4000-8000-000000000005",
  storefrontConfig: "00000000-0000-4000-8000-000000000006",
  user: "00000000-0000-4000-8000-000000000007",
  tenantMembership: "00000000-0000-4000-8000-000000000008",
} as const;

export function buildPlatformSeed(options: PlatformSeedOptions) {
  const [template] = options.templates;

  if (!template) {
    throw new Error("At least one storefront template is required for platform seed data.");
  }

  const hostname = `abebe.${normalizeBaseDomain(options.storefrontBaseDomain)}`;
  const medusaPublishableKeyId = options.medusaPublishableKeyId.trim();

  if (!medusaPublishableKeyId) {
    throw new Error("A Medusa publishable API key is required for platform seed data.");
  }

  return {
    ids: localIds,
    tenant: {
      id: localIds.tenant,
      name: "Abebe Market",
      handle: "abebe",
      status: "active" as const,
      primaryDomainId: localIds.domain,
      medusaStoreId: "store_local_abebe",
      medusaSalesChannelId: "sc_local_abebe",
      medusaPublishableKeyId,
      medusaStockLocationId: "sloc_local_abebe",
    },
    domain: {
      id: localIds.domain,
      tenantId: localIds.tenant,
      hostname,
      type: "platform",
      status: "active",
      isPrimary: true,
      verificationStatus: "verified",
      sslStatus: "active",
    },
    user: {
      id: localIds.user,
      email: "owner@abebe.local",
      phone: "+251911000000",
      name: "Abebe Owner",
      status: "active",
    },
    tenantMembership: {
      id: localIds.tenantMembership,
      tenantId: localIds.tenant,
      userId: localIds.user,
      role: "owner" as const,
      status: "active",
    },
    templates: [
      {
        id: localIds.template,
        slug: template.slug,
        name: template.name,
        description: template.description,
        status: "active" as const,
        tags: ["default", "local"],
        sortOrder: 0,
      },
    ],
    templateVersions: [
      {
        id: localIds.templateVersion,
        templateId: localIds.template,
        version: template.version,
        templateKey: template.templateKey,
        schema: z.toJSONSchema(template.schema),
        defaultData: template.defaultData,
        defaultThemeTokens: template.defaultThemeTokens,
        previewData: template.defaultData,
        componentRegistryVersion: "local",
        sourceHash: `${template.templateKey}:local`,
        status: "active" as const,
      },
    ],
    storefrontRevision: {
      id: localIds.storefrontRevision,
      tenantId: localIds.tenant,
      templateId: localIds.template,
      templateVersion: template.version,
      templateKey: template.templateKey,
      data: template.defaultData,
      themeTokens: template.defaultThemeTokens,
    },
    storefrontConfig: {
      id: localIds.storefrontConfig,
      tenantId: localIds.tenant,
      draftTemplateId: localIds.template,
      draftTemplateVersion: template.version,
      draftData: template.defaultData,
      draftThemeTokens: template.defaultThemeTokens,
      publishedRevisionId: localIds.storefrontRevision,
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

function normalizeBaseDomain(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}
