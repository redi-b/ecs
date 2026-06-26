import type { createPlatformDb } from "@ecs/db";
import {
  domains,
  reservedHandles,
  storefrontConfigs,
  storefrontTemplates,
  storefrontTemplateVersions,
  tenantMemberships,
  tenants,
} from "@ecs/db";
import { and, asc, desc, eq } from "drizzle-orm";

import type { TenantShopProvisioningResult } from "../app.js";
import type {
  CommerceProvisioningInput,
  CommerceProvisioningResult,
} from "./medusa-commerce-provisioning.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type TenantShopProvisioningOptions = {
  db: PlatformDb;
  platformBaseDomain: string;
  provisionCommerceResources: (
    input: CommerceProvisioningInput,
  ) => Promise<CommerceProvisioningResult>;
};

const handlePattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

function normalizeBaseDomain(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

function getPlatformHostname(handle: string, platformBaseDomain: string) {
  return `${handle}.${normalizeBaseDomain(platformBaseDomain)}`;
}

function requireRow<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function createTenantShopProvisioningService(options: TenantShopProvisioningOptions) {
  return async function createTenantShop(input: {
    handle: string;
    name: string;
    ownerUserId: string;
  }): Promise<TenantShopProvisioningResult> {
    const handle = normalizeHandle(input.handle);
    const name = input.name.trim();

    if (!handlePattern.test(handle)) {
      return {
        ok: false,
        error: "handle_invalid",
        status: 400,
      };
    }

    const [reservedHandle] = await options.db
      .select({ id: reservedHandles.id })
      .from(reservedHandles)
      .where(eq(reservedHandles.handle, handle))
      .limit(1);

    if (reservedHandle) {
      return {
        ok: false,
        error: "handle_reserved",
        status: 409,
      };
    }

    const hostname = getPlatformHostname(handle, options.platformBaseDomain);

    const [existingTenant] = await options.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.handle, handle))
      .limit(1);

    const [existingDomain] = await options.db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.hostname, hostname))
      .limit(1);

    if (existingTenant || existingDomain) {
      return {
        ok: false,
        error: "handle_unavailable",
        status: 409,
      };
    }

    const tenantId = crypto.randomUUID();
    const commerceResources = await options.provisionCommerceResources({
      handle,
      name,
      platformTenantId: tenantId,
      requestedByUserId: input.ownerUserId,
    });

    if (!commerceResources.ok) {
      return {
        ok: false,
        error: commerceResources.error,
        status: 503,
      };
    }

    const [activeTemplate] = await options.db
      .select({
        templateId: storefrontTemplates.id,
        templateVersion: storefrontTemplateVersions.version,
        defaultData: storefrontTemplateVersions.defaultData,
        defaultThemeTokens: storefrontTemplateVersions.defaultThemeTokens,
      })
      .from(storefrontTemplates)
      .innerJoin(
        storefrontTemplateVersions,
        eq(storefrontTemplateVersions.templateId, storefrontTemplates.id),
      )
      .where(
        and(
          eq(storefrontTemplates.status, "active"),
          eq(storefrontTemplateVersions.status, "active"),
        ),
      )
      .orderBy(asc(storefrontTemplates.sortOrder), desc(storefrontTemplateVersions.version))
      .limit(1);

    if (!activeTemplate) {
      return {
        ok: false,
        error: "storefront_template_unavailable",
        status: 503,
      };
    }

    const tenant = await options.db.transaction(async (transaction) => {
      const [createdTenant] = await transaction
        .insert(tenants)
        .values({
          id: tenantId,
          name,
          handle,
          status: "draft",
          medusaStoreId: commerceResources.resources.storeId,
          medusaSalesChannelId: commerceResources.resources.salesChannelId,
          medusaPublishableKeyId: commerceResources.resources.publishableKeyId,
          medusaStockLocationId: commerceResources.resources.stockLocationId,
        })
        .returning({
          id: tenants.id,
          name: tenants.name,
          handle: tenants.handle,
          status: tenants.status,
        });

      const createdTenantRow = requireRow(createdTenant, "Tenant insert returned no rows.");

      const [primaryDomain] = await transaction
        .insert(domains)
        .values({
          tenantId,
          hostname,
          type: "platform_subdomain",
          status: "active",
          isPrimary: true,
          verificationStatus: "verified",
          sslStatus: "active",
        })
        .returning({
          id: domains.id,
          hostname: domains.hostname,
        });

      const primaryDomainRow = requireRow(primaryDomain, "Domain insert returned no rows.");

      await transaction
        .update(tenants)
        .set({
          primaryDomainId: primaryDomainRow.id,
        })
        .where(eq(tenants.id, tenantId));

      await transaction.insert(tenantMemberships).values({
        tenantId,
        userId: input.ownerUserId,
        role: "owner",
        status: "active",
      });

      await transaction.insert(storefrontConfigs).values({
        tenantId,
        draftTemplateId: activeTemplate.templateId,
        draftTemplateVersion: activeTemplate.templateVersion,
        draftData: activeTemplate.defaultData,
        draftThemeTokens: activeTemplate.defaultThemeTokens,
      });

      return {
        ...createdTenantRow,
        primaryDomain: primaryDomainRow,
      };
    });

    return {
      ok: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        handle: tenant.handle,
        status: tenant.status,
        primaryDomain: {
          hostname: tenant.primaryDomain.hostname,
        },
      },
    };
  };
}
