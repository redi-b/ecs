import type { createPlatformDb } from "@ecs/db";
import { domains, storefrontConfigs, storefrontTemplateVersions, tenants } from "@ecs/db";
import { and, eq, isNull } from "drizzle-orm";

import type { TenantDomainRecord } from "./tenant-resolver.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createDomainTenantLookup(db: PlatformDb) {
  return async function findDomainByHostname(
    hostname: string,
  ): Promise<TenantDomainRecord | undefined> {
    const [row] = await db
      .select({
        domainId: domains.id,
        hostname: domains.hostname,
        domainStatus: domains.status,
        domainType: domains.type,
        sslStatus: domains.sslStatus,
        activatedAt: domains.activatedAt,
        warningSince: domains.warningSince,
        warningReason: domains.warningReason,
        verificationStatus: domains.verificationStatus,
        primaryDomainId: tenants.primaryDomainId,
        tenantId: tenants.id,
        tenantName: tenants.name,
        shopDetails: tenants.shopDetails,
        tenantHandle: tenants.handle,
        tenantStatus: tenants.status,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaStockLocationId: tenants.medusaStockLocationId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        medusaRegionId: tenants.medusaRegionId,
        medusaShippingProfileId: tenants.medusaShippingProfileId,
        medusaShippingOptionId: tenants.medusaShippingOptionId,
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
        templateId: storefrontConfigs.draftTemplateId,
        templateKey: storefrontTemplateVersions.templateKey,
        templateVersion: storefrontConfigs.draftTemplateVersion,
      })
      .from(domains)
      .innerJoin(tenants, eq(domains.tenantId, tenants.id))
      .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
      .leftJoin(
        storefrontTemplateVersions,
        and(
          eq(storefrontTemplateVersions.templateId, storefrontConfigs.draftTemplateId),
          eq(storefrontTemplateVersions.version, storefrontConfigs.draftTemplateVersion),
        ),
      )
      .where(and(eq(domains.hostname, hostname), isNull(domains.removedAt)))
      .limit(1);

    if (!row) return undefined;

    const [primaryDomain] = row.primaryDomainId
      ? await db
          .select({
            hostname: domains.hostname,
            status: domains.status,
            verificationStatus: domains.verificationStatus,
            type: domains.type,
            sslStatus: domains.sslStatus,
            activatedAt: domains.activatedAt,
            warningSince: domains.warningSince,
            warningReason: domains.warningReason,
          })
          .from(domains)
          .where(
            and(
              eq(domains.id, row.primaryDomainId),
              eq(domains.tenantId, row.tenantId),
              isNull(domains.removedAt),
            ),
          )
          .limit(1)
      : [];

    return {
      ...row,
      primaryHostname: primaryDomain?.hostname ?? null,
      primaryDomainStatus: primaryDomain?.status ?? null,
      primaryDomainVerificationStatus: primaryDomain?.verificationStatus ?? null,
      primaryDomainType: primaryDomain?.type ?? null,
      primaryDomainSslStatus: primaryDomain?.sslStatus ?? null,
      primaryDomainActivatedAt: primaryDomain?.activatedAt ?? null,
      primaryDomainWarningSince: primaryDomain?.warningSince ?? null,
      primaryDomainWarningReason: primaryDomain?.warningReason ?? null,
    };
  };
}
