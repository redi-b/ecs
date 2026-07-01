import type { createPlatformDb } from "@ecs/db";
import {
  domains,
  storefrontConfigs,
  storefrontRevisions,
  tenantMemberships,
  tenants,
  users,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type { TenantCommerceContextResult, TenantDashboardSummaryResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

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

    if (!row) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    if (!row.medusaSalesChannelId) {
      return {
        ok: false,
        error: "commerce_sales_channel_unavailable",
        status: 503,
      };
    }

    return {
      ok: true,
      context: {
        tenantId: row.id,
        medusaStoreId: row.medusaStoreId,
        medusaSalesChannelId: row.medusaSalesChannelId,
        medusaPublishableKeyId: row.medusaPublishableKeyId,
        medusaRegionId: row.medusaRegionId,
      },
    };
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
        templateId: storefrontRevisions.templateId,
        templateVersion: storefrontRevisions.templateVersion,
      })
      .from(tenants)
      .innerJoin(domains, eq(tenants.primaryDomainId, domains.id))
      .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
      .leftJoin(
        storefrontRevisions,
        eq(storefrontConfigs.publishedRevisionId, storefrontRevisions.id),
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
          templateVersion: row.templateVersion,
        },
      },
    };
  };
}
