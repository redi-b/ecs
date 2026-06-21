import type { createPlatformDb } from "@ecs/db";
import { domains, storefrontConfigs, storefrontRevisions, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

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
        tenantHandle: tenants.handle,
        tenantStatus: tenants.status,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        publishedRevisionId: storefrontConfigs.publishedRevisionId,
        templateId: storefrontRevisions.templateId,
        templateVersion: storefrontRevisions.templateVersion,
      })
      .from(domains)
      .innerJoin(tenants, eq(domains.tenantId, tenants.id))
      .leftJoin(storefrontConfigs, eq(storefrontConfigs.tenantId, tenants.id))
      .leftJoin(
        storefrontRevisions,
        eq(storefrontConfigs.publishedRevisionId, storefrontRevisions.id),
      )
      .where(eq(domains.hostname, hostname))
      .limit(1);

    return row;
  };
}
