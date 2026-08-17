import type { createPlatformDb } from "@ecs/db";
import {
  domains,
  storefrontConfigs,
  storefrontRevisions,
  storefrontTemplateDrafts,
  storefrontTemplateVersions,
  tenantMemberships,
  tenants,
  users,
} from "@ecs/db";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";

import type {
  TenantCommerceContextResult,
  TenantDashboardSummaryResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type TenantCommerceContextRow = {
  id: string;
  medusaStoreId: string | null;
  medusaSalesChannelId: string | null;
  medusaStockLocationId: string | null;
  medusaPublishableKeyId: string | null;
  medusaRegionId: string | null;
  medusaShippingProfileId: string | null;
  medusaShippingOptionId: string | null;
};

export function hasStorefrontUnpublishedChanges(input: {
  draftData: unknown;
  draftTemplateKey: string | null;
  draftThemeTokens: unknown;
  publishedData: unknown;
  publishedRevisionId: string | null;
  publishedTemplateKey: string | null;
  publishedThemeTokens: unknown;
}) {
  return Boolean(
    input.publishedRevisionId &&
      (input.draftTemplateKey !== input.publishedTemplateKey ||
        !isDeepStrictEqual(input.draftData, input.publishedData) ||
        !isDeepStrictEqual(input.draftThemeTokens, input.publishedThemeTokens)),
  );
}

export function buildTenantCommerceContext(
  row: TenantCommerceContextRow | undefined,
): TenantCommerceContextResult {
  if (!row) {
    return {
      ok: false,
      error: "tenant_not_found",
      status: 404,
    };
  }

  if (!row.medusaStoreId) {
    return {
      ok: false,
      error: "commerce_store_unavailable",
      status: 503,
    };
  }

  if (!row.medusaSalesChannelId) {
    return {
      ok: false,
      error: "commerce_sales_channel_unavailable",
      status: 503,
    };
  }

  if (!row.medusaStockLocationId) {
    return {
      ok: false,
      error: "inventory_location_unavailable",
      status: 503,
    };
  }

  if (!row.medusaPublishableKeyId) {
    return {
      ok: false,
      error: "commerce_publishable_key_unavailable",
      status: 503,
    };
  }

  if (!row.medusaRegionId) {
    return {
      ok: false,
      error: "commerce_region_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    context: {
      tenantId: row.id,
      medusaStoreId: row.medusaStoreId,
      medusaSalesChannelId: row.medusaSalesChannelId,
      medusaStockLocationId: row.medusaStockLocationId,
      medusaPublishableKeyId: row.medusaPublishableKeyId,
      medusaRegionId: row.medusaRegionId,
      medusaShippingProfileId: row.medusaShippingProfileId,
      medusaShippingOptionId: row.medusaShippingOptionId,
    },
  };
}

export function createTenantCommerceContextService(db: PlatformDb) {
  return async function getTenantCommerceContext(input: {
    tenantId: string;
    userId: string;
  }): Promise<TenantCommerceContextResult> {
    const [row] = await db
      .select({
        id: tenants.id,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaStockLocationId: tenants.medusaStockLocationId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        medusaRegionId: tenants.medusaRegionId,
        medusaShippingProfileId: tenants.medusaShippingProfileId,
        medusaShippingOptionId: tenants.medusaShippingOptionId,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    return buildTenantCommerceContext(row);
  };
}

export function createTenantDashboardSummaryService(db: PlatformDb) {
  return async function getTenantDashboardSummary(input: {
    tenantId: string;
  }): Promise<TenantDashboardSummaryResult> {
    const [row] = await db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantHandle: tenants.handle,
        tenantStatus: tenants.status,
        domainId: domains.id,
        hostname: domains.hostname,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaStockLocationId: tenants.medusaStockLocationId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        medusaRegionId: tenants.medusaRegionId,
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
        publishedTemplateKey: storefrontRevisions.templateKey,
        draftData: storefrontConfigs.draftData,
        draftThemeTokens: storefrontConfigs.draftThemeTokens,
        publishedData: storefrontRevisions.data,
        publishedThemeTokens: storefrontRevisions.themeTokens,
        templateId: storefrontConfigs.draftTemplateId,
        templateKey: storefrontTemplateVersions.templateKey,
        templateVersion: storefrontConfigs.draftTemplateVersion,
      })
      .from(tenants)
      .innerJoin(domains, eq(tenants.primaryDomainId, domains.id))
      .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
      .leftJoin(
        storefrontTemplateVersions,
        and(
          eq(storefrontTemplateVersions.templateId, storefrontConfigs.draftTemplateId),
          eq(storefrontTemplateVersions.version, storefrontConfigs.draftTemplateVersion),
        ),
      )
      .leftJoin(
        storefrontRevisions,
        eq(storefrontRevisions.id, storefrontConfigs.publishedRevisionId),
      )
      .where(eq(tenants.id, input.tenantId))
      .limit(1);

    if (!row) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    const savedDrafts = await db
      .select({ templateKey: storefrontTemplateVersions.templateKey })
      .from(storefrontTemplateDrafts)
      .innerJoin(
        storefrontTemplateVersions,
        eq(storefrontTemplateDrafts.templateVersionId, storefrontTemplateVersions.id),
      )
      .where(eq(storefrontTemplateDrafts.tenantId, input.tenantId));
    const hasUnpublishedChanges = hasStorefrontUnpublishedChanges({
      draftData: row.draftData,
      draftTemplateKey: row.templateKey,
      draftThemeTokens: row.draftThemeTokens,
      publishedData: row.publishedData,
      publishedRevisionId: row.publishedRevisionId,
      publishedTemplateKey: row.publishedTemplateKey,
      publishedThemeTokens: row.publishedThemeTokens,
    });
    const savedTemplateKeys = [...new Set(savedDrafts.map((draft) => draft.templateKey))];

    const context = {
      domainId: row.domainId,
      hostname: row.hostname,
      medusaPublishableKeyId: row.medusaPublishableKeyId,
      medusaRegionId: row.medusaRegionId,
      medusaSalesChannelId: row.medusaSalesChannelId,
      medusaStockLocationId: row.medusaStockLocationId,
      medusaStoreId: row.medusaStoreId,
      publishedRevisionId: row.publishedRevisionId,
      publishedTemplateKey: row.publishedTemplateKey,
      hasUnpublishedChanges,
      savedTemplateKeys,
      status: row.tenantStatus,
      templateId: row.templateId,
      templateKey: row.templateKey,
      templateVersion: row.templateVersion,
      tenantHandle: row.tenantHandle,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
    };

    return {
      ok: true,
      context,
      summary: {
        tenant: {
          id: row.tenantId,
          name: row.tenantName,
          handle: row.tenantHandle,
          status: row.tenantStatus,
        },
        domain: {
          id: row.domainId,
          hostname: row.hostname,
        },
        commerce: {
          hasPublishableKey: Boolean(row.medusaPublishableKeyId),
          hasSalesChannel: Boolean(row.medusaSalesChannelId),
          hasStore: Boolean(row.medusaStoreId),
        },
        storefront: {
          isPublished: Boolean(row.publishedRevisionId),
          hasUnpublishedChanges,
          publishedRevisionId: row.publishedRevisionId,
          publishedTemplateKey: row.publishedTemplateKey,
          savedTemplateKeys,
          templateId: row.templateId,
          templateKey: row.templateKey,
          templateVersion: row.templateVersion,
        },
      },
    };
  };
}
