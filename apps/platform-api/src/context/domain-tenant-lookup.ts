import type { createPlatformDb } from "@ecs/db";
import { domains, storefrontConfigs, storefrontTemplateVersions, tenants } from "@ecs/db";
import { and, eq } from "drizzle-orm";

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
        verificationStatus: domains.verificationStatus,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantHandle: tenants.handle,
        tenantStatus: tenants.status,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaStockLocationId: tenants.medusaStockLocationId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        medusaRegionId: tenants.medusaRegionId,
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
      .where(eq(domains.hostname, hostname))
      .limit(1);

    return row;
  };
}
