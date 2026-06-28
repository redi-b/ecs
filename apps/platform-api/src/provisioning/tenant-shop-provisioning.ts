import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  domains,
  reservedHandles,
  storefrontConfigs,
  storefrontTemplates,
  storefrontTemplateVersions,
  tenantMemberships,
  tenantOnboarding,
  tenants,
} from "@ecs/db";
import { and, asc, desc, eq } from "drizzle-orm";

import type { TenantShopProvisioningResult } from "../app.js";
import type {
  CommerceProvisioningInput,
  CommerceProvisioningResult,
} from "./medusa-commerce-provisioning.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type ExistingTenantShop = {
  id: string;
  name: string;
  handle: string;
  status: string;
  primaryDomainHostname: string | null;
  ownerUserId: string | null;
};

type ActiveStorefrontTemplate = {
  templateId: string;
  templateVersion: number;
  defaultData: unknown;
  defaultThemeTokens: unknown;
};

type CreatedTenantShop = {
  id: string;
  name: string;
  handle: string;
  status: string;
  primaryDomain: {
    hostname: string;
  };
};

type TenantShopProvisionerOptions = {
  createTenantShopRecord: (input: {
    activeTemplate: ActiveStorefrontTemplate;
    commerceResources: {
      storeId: string;
      salesChannelId: string;
      stockLocationId: string;
      publishableKeyId: string;
      regionId: string;
      shippingProfileId: string;
      fulfillmentSetId: string;
      serviceZoneId: string;
      shippingOptionId: string;
    };
    handle: string;
    hostname: string;
    name: string;
    ownerUserId: string;
    tenantId: string;
  }) => Promise<CreatedTenantShop>;
  findActiveStorefrontTemplate: () => Promise<ActiveStorefrontTemplate | undefined>;
  findExistingTenantByHandle: (
    handle: string,
    ownerUserId: string,
  ) => Promise<ExistingTenantShop | undefined>;
  isDomainHostnameTaken: (hostname: string) => Promise<boolean>;
  isHandleReserved: (handle: string) => Promise<boolean>;
  platformBaseDomain: string;
  provisionCommerceResources: (
    input: CommerceProvisioningInput,
  ) => Promise<CommerceProvisioningResult>;
};

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

export function buildInitialTenantOnboardingState() {
  return {
    status: "in_progress",
    currentStep: "storefront_review",
    completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
  };
}

export function createTenantShopProvisioner(options: TenantShopProvisionerOptions) {
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

    if (await options.isHandleReserved(handle)) {
      return {
        ok: false,
        error: "handle_reserved",
        status: 409,
      };
    }

    const hostname = getPlatformHostname(handle, options.platformBaseDomain);

    const existingTenant = await options.findExistingTenantByHandle(handle, input.ownerUserId);

    if (existingTenant) {
      if (
        existingTenant.ownerUserId === input.ownerUserId &&
        existingTenant.primaryDomainHostname
      ) {
        return {
          ok: true,
          tenant: {
            id: existingTenant.id,
            name: existingTenant.name,
            handle: existingTenant.handle,
            status: existingTenant.status,
            primaryDomain: {
              hostname: existingTenant.primaryDomainHostname,
            },
          },
        };
      }

      return {
        ok: false,
        error: "handle_unavailable",
        status: 409,
      };
    }

    if (await options.isDomainHostnameTaken(hostname)) {
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

    const activeTemplate = await options.findActiveStorefrontTemplate();

    if (!activeTemplate) {
      return {
        ok: false,
        error: "storefront_template_unavailable",
        status: 503,
      };
    }

    const tenant = await options.createTenantShopRecord({
      activeTemplate,
      commerceResources: commerceResources.resources,
      handle,
      hostname,
      name,
      ownerUserId: input.ownerUserId,
      tenantId,
    });

    return {
      ok: true,
      tenant,
    };
  };
}

export function createTenantShopProvisioningService(options: TenantShopProvisioningOptions) {
  return createTenantShopProvisioner({
    createTenantShopRecord: async ({
      activeTemplate,
      commerceResources,
      handle,
      hostname,
      name,
      ownerUserId,
      tenantId,
    }) => {
      const tenant = await options.db.transaction(async (transaction) => {
        const [createdTenant] = await transaction
          .insert(tenants)
          .values({
            id: tenantId,
            name,
            handle,
            status: "draft",
            medusaStoreId: commerceResources.storeId,
            medusaSalesChannelId: commerceResources.salesChannelId,
            medusaPublishableKeyId: commerceResources.publishableKeyId,
            medusaStockLocationId: commerceResources.stockLocationId,
            medusaRegionId: commerceResources.regionId,
            medusaShippingProfileId: commerceResources.shippingProfileId,
            medusaFulfillmentSetId: commerceResources.fulfillmentSetId,
            medusaServiceZoneId: commerceResources.serviceZoneId,
            medusaShippingOptionId: commerceResources.shippingOptionId,
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
          userId: ownerUserId,
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

        await transaction.insert(tenantOnboarding).values({
          tenantId,
          ...buildInitialTenantOnboardingState(),
        });

        await transaction.insert(auditLogs).values({
          actorUserId: ownerUserId,
          tenantId,
          action: "shop.provisioned",
          targetType: "tenant",
          targetId: tenantId,
          metadata: {
            handle,
            hostname,
            medusaStoreId: commerceResources.storeId,
            medusaSalesChannelId: commerceResources.salesChannelId,
            medusaPublishableKeyId: commerceResources.publishableKeyId,
            medusaStockLocationId: commerceResources.stockLocationId,
            medusaRegionId: commerceResources.regionId,
            medusaShippingProfileId: commerceResources.shippingProfileId,
            medusaFulfillmentSetId: commerceResources.fulfillmentSetId,
            medusaServiceZoneId: commerceResources.serviceZoneId,
            medusaShippingOptionId: commerceResources.shippingOptionId,
          },
        });

        return {
          ...createdTenantRow,
          primaryDomain: primaryDomainRow,
        };
      });

      return {
        id: tenant.id,
        name: tenant.name,
        handle: tenant.handle,
        status: tenant.status,
        primaryDomain: {
          hostname: tenant.primaryDomain.hostname,
        },
      };
    },
    findActiveStorefrontTemplate: async () => {
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

      return activeTemplate;
    },
    findExistingTenantByHandle: async (handle, ownerUserId) => {
      const [existingTenant] = await options.db
        .select({
          id: tenants.id,
          name: tenants.name,
          handle: tenants.handle,
          status: tenants.status,
          primaryDomainHostname: domains.hostname,
          ownerUserId: tenantMemberships.userId,
        })
        .from(tenants)
        .leftJoin(domains, eq(domains.id, tenants.primaryDomainId))
        .leftJoin(
          tenantMemberships,
          and(
            eq(tenantMemberships.tenantId, tenants.id),
            eq(tenantMemberships.status, "active"),
            eq(tenantMemberships.role, "owner"),
            eq(tenantMemberships.userId, ownerUserId),
          ),
        )
        .where(eq(tenants.handle, handle))
        .limit(1);

      return existingTenant;
    },
    isDomainHostnameTaken: async (hostname) => {
      const [existingDomain] = await options.db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.hostname, hostname))
        .limit(1);

      return Boolean(existingDomain);
    },
    isHandleReserved: async (handle) => {
      const [reservedHandle] = await options.db
        .select({ id: reservedHandles.id })
        .from(reservedHandles)
        .where(eq(reservedHandles.handle, handle))
        .limit(1);

      return Boolean(reservedHandle);
    },
    platformBaseDomain: options.platformBaseDomain,
    provisionCommerceResources: options.provisionCommerceResources,
  });
}
