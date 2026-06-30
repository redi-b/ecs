import type { createPlatformDb } from "@ecs/db";
import { auditLogs, domains, storefrontConfigs, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type {
  TenantReadiness,
  TenantReadinessMissingReason,
  TenantReadinessResult,
  TenantStatus,
  TenantStatusUpdateResult,
} from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const allowedOperatorStatuses = new Set<TenantStatus>(["active", "suspended"]);

function normalizeTenantStatus(value: string) {
  return value.trim().toLowerCase();
}

function appendMissing(
  target: TenantReadinessMissingReason[],
  condition: boolean,
  reason: TenantReadinessMissingReason,
) {
  if (condition) {
    target.push(reason);
  }
}

type TenantReadinessRow = {
  id: string;
  name: string;
  handle: string;
  status: TenantStatus | string;
  primaryDomainId: string | null;
  primaryDomainStatus: string | null;
  primaryDomainVerificationStatus: string | null;
  medusaStoreId: string | null;
  medusaSalesChannelId: string | null;
  medusaPublishableKeyId: string | null;
  medusaRegionId: string | null;
  medusaShippingOptionId: string | null;
  draftTemplateId: string | null;
  publishedRevisionId: string | null;
};

export function buildTenantReadiness(row: TenantReadinessRow): TenantReadiness {
  const tenantMissing: TenantReadinessMissingReason[] = [];
  appendMissing(tenantMissing, row.status !== "active", "tenant_inactive");

  const domainMissing: TenantReadinessMissingReason[] = [];
  appendMissing(domainMissing, !row.primaryDomainId, "primary_domain_missing");
  appendMissing(
    domainMissing,
    Boolean(row.primaryDomainId) && row.primaryDomainStatus !== "active",
    "primary_domain_inactive",
  );
  appendMissing(
    domainMissing,
    Boolean(row.primaryDomainId) && row.primaryDomainVerificationStatus !== "verified",
    "primary_domain_unverified",
  );

  const commerceMissing: TenantReadinessMissingReason[] = [];
  appendMissing(commerceMissing, !row.medusaStoreId, "commerce_store_missing");
  appendMissing(commerceMissing, !row.medusaSalesChannelId, "commerce_sales_channel_missing");
  appendMissing(commerceMissing, !row.medusaPublishableKeyId, "commerce_publishable_key_missing");
  appendMissing(commerceMissing, !row.medusaRegionId, "commerce_region_missing");
  appendMissing(commerceMissing, !row.medusaShippingOptionId, "commerce_shipping_option_missing");

  const storefrontMissing: TenantReadinessMissingReason[] = [];
  appendMissing(storefrontMissing, !row.draftTemplateId, "storefront_draft_missing");
  appendMissing(storefrontMissing, !row.publishedRevisionId, "storefront_unpublished");

  const missing = [...tenantMissing, ...domainMissing, ...commerceMissing, ...storefrontMissing];

  return {
    ready: missing.length === 0,
    missing,
    tenant: {
      id: row.id,
      name: row.name,
      handle: row.handle,
      status: row.status,
    },
    checks: {
      tenant: {
        ready: tenantMissing.length === 0,
        missing: tenantMissing,
        isActive: row.status === "active",
      },
      domain: {
        ready: domainMissing.length === 0,
        missing: domainMissing,
        hasPrimaryDomain: Boolean(row.primaryDomainId),
        isActive: row.primaryDomainStatus === "active",
        isVerified: row.primaryDomainVerificationStatus === "verified",
      },
      commerce: {
        ready: commerceMissing.length === 0,
        missing: commerceMissing,
        hasStore: Boolean(row.medusaStoreId),
        hasSalesChannel: Boolean(row.medusaSalesChannelId),
        hasPublishableKey: Boolean(row.medusaPublishableKeyId),
        hasRegion: Boolean(row.medusaRegionId),
        hasShippingOption: Boolean(row.medusaShippingOptionId),
      },
      storefront: {
        ready: storefrontMissing.length === 0,
        missing: storefrontMissing,
        hasDraft: Boolean(row.draftTemplateId),
        isPublished: Boolean(row.publishedRevisionId),
      },
    },
  };
}

export function createTenantStatusService(db: PlatformDb) {
  return {
    getTenantReadiness: async (input: { tenantId: string }): Promise<TenantReadinessResult> => {
      const [row] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          handle: tenants.handle,
          status: tenants.status,
          primaryDomainId: tenants.primaryDomainId,
          primaryDomainStatus: domains.status,
          primaryDomainVerificationStatus: domains.verificationStatus,
          medusaStoreId: tenants.medusaStoreId,
          medusaSalesChannelId: tenants.medusaSalesChannelId,
          medusaPublishableKeyId: tenants.medusaPublishableKeyId,
          medusaRegionId: tenants.medusaRegionId,
          medusaShippingOptionId: tenants.medusaShippingOptionId,
          draftTemplateId: storefrontConfigs.draftTemplateId,
          publishedRevisionId: storefrontConfigs.publishedRevisionId,
        })
        .from(tenants)
        .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
        .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
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
        readiness: buildTenantReadiness(row),
      };
    },
    updateTenantStatus: async (input: {
      operatorUserId: string;
      reason?: string | null | undefined;
      status: string;
      tenantId: string;
    }): Promise<TenantStatusUpdateResult> => {
      const status = normalizeTenantStatus(input.status);

      if (!allowedOperatorStatuses.has(status as TenantStatus)) {
        return {
          ok: false,
          error: "tenant_status_invalid",
          status: 400,
        };
      }

      const tenant = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(tenants)
          .set({
            status: status as TenantStatus,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId))
          .returning({
            id: tenants.id,
            name: tenants.name,
            handle: tenants.handle,
            status: tenants.status,
          });

        if (!row) {
          return null;
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          tenantId: input.tenantId,
          action: "tenant.status_changed",
          targetType: "tenant",
          targetId: row.id,
          metadata: {
            reason: input.reason ?? null,
            status: row.status,
          },
        });

        return row;
      });

      if (!tenant) {
        return {
          ok: false,
          error: "tenant_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        tenant,
      };
    },
  };
}
