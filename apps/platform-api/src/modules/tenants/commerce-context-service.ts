import type { createPlatformDb } from "@ecs/db";
import {
  domains,
  storefrontConfigs,
  storefrontTemplateVersions,
  tenantMemberships,
  tenants,
  users,
} from "@ecs/db";
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
};

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
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
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
      .where(eq(tenants.id, input.tenantId))
      .limit(1);

    if (!row) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    return {
      ok: true,
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
          publishedRevisionId: row.publishedRevisionId,
          templateId: row.templateId,
          templateKey: row.templateKey,
          templateVersion: row.templateVersion,
        },
      },
    };
  };
}
