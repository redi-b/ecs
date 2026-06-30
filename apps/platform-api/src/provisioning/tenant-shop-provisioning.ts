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
  tenantProvisioningAttempts,
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
  recordAnalyticsEvent?: (input: {
    eventType: string;
    idempotencyKey?: string | null | undefined;
    properties?: unknown;
    source: "medusa" | "platform" | "storefront";
    subjectId?: string | null | undefined;
    subjectType?: string | null | undefined;
    tenantId: string;
  }) => Promise<{ ok: boolean }>;
  recordProvisioningAttempt?: (input: {
    error?: string | null | undefined;
    handle: string;
    name?: string | null | undefined;
    ownerUserId: string;
    platformTenantId: string;
    status: string;
    step: string;
    tenantId?: string | null | undefined;
  }) => Promise<void>;
};

type TenantShopProvisioningOptions = {
  db: PlatformDb;
  platformBaseDomain: string;
  provisionCommerceResources: (
    input: CommerceProvisioningInput,
  ) => Promise<CommerceProvisioningResult>;
  recordAnalyticsEvent?: TenantShopProvisionerOptions["recordAnalyticsEvent"];
  recordProvisioningAttempt?: TenantShopProvisionerOptions["recordProvisioningAttempt"];
};

type TenantShopProvisioningRetryOptions = {
  createTenantShop: (input: {
    handle: string;
    name: string;
    ownerUserId: string;
  }) => Promise<TenantShopProvisioningResult>;
  findProvisioningAttemptForRetry: (attemptId: string) => Promise<
    | {
        handle: string;
        id: string;
        name: string;
        ownerUserId: string;
        status: string;
        tenantId: string | null;
      }
    | undefined
  >;
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

async function recordProvisioningAttempt(
  recorder: TenantShopProvisionerOptions["recordProvisioningAttempt"],
  input: {
    error?: string | null | undefined;
    handle: string;
    ownerUserId: string;
    platformTenantId: string;
    status: string;
    step: string;
    name?: string | null | undefined;
    tenantId?: string | null | undefined;
  },
) {
  try {
    await recorder?.(input);
  } catch {
    // Provisioning attempt logging must not fail tenant provisioning.
  }
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
      await recordProvisioningAttempt(options.recordProvisioningAttempt, {
        error: commerceResources.error,
        handle,
        name,
        ownerUserId: input.ownerUserId,
        platformTenantId: tenantId,
        status: "failed",
        step: "commerce_resources",
        tenantId: null,
      });

      return {
        ok: false,
        error: commerceResources.error,
        status: 503,
      };
    }

    const activeTemplate = await options.findActiveStorefrontTemplate();

    if (!activeTemplate) {
      await recordProvisioningAttempt(options.recordProvisioningAttempt, {
        error: "storefront_template_unavailable",
        handle,
        name,
        ownerUserId: input.ownerUserId,
        platformTenantId: tenantId,
        status: "failed",
        step: "storefront_template",
        tenantId: null,
      });

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

    await recordProvisioningAttempt(options.recordProvisioningAttempt, {
      handle,
      name,
      ownerUserId: input.ownerUserId,
      platformTenantId: tenantId,
      status: "completed",
      step: "tenant_shop",
      tenantId: tenant.id,
    });

    try {
      await options.recordAnalyticsEvent?.({
        eventType: "tenant.created",
        idempotencyKey: `tenant:${tenant.id}:tenant.created`,
        properties: {
          handle,
          hostname,
          medusaPublishableKeyId: commerceResources.resources.publishableKeyId,
          medusaRegionId: commerceResources.resources.regionId,
          medusaSalesChannelId: commerceResources.resources.salesChannelId,
          medusaShippingOptionId: commerceResources.resources.shippingOptionId,
          medusaStoreId: commerceResources.resources.storeId,
          ownerUserId: input.ownerUserId,
        },
        source: "platform",
        subjectId: tenant.id,
        subjectType: "tenant",
        tenantId: tenant.id,
      });
    } catch {
      // Analytics logging must not fail tenant provisioning.
    }

    return {
      ok: true,
      tenant,
    };
  };
}

export function createTenantShopProvisioningService(options: TenantShopProvisioningOptions) {
  const provisionerOptions: TenantShopProvisionerOptions = {
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
    recordProvisioningAttempt: async (input) => {
      await options.db.insert(tenantProvisioningAttempts).values({
        tenantId: input.tenantId ?? null,
        platformTenantId: input.platformTenantId,
        handle: input.handle,
        ownerUserId: input.ownerUserId,
        step: input.step,
        status: input.status,
        error: input.error ?? null,
        metadata: {
          name: input.name ?? null,
        },
        completedAt: new Date(),
      });
    },
  };

  if (options.recordAnalyticsEvent) {
    provisionerOptions.recordAnalyticsEvent = options.recordAnalyticsEvent;
  }

  if (options.recordProvisioningAttempt) {
    provisionerOptions.recordProvisioningAttempt = options.recordProvisioningAttempt;
  }

  return createTenantShopProvisioner(provisionerOptions);
}

export function createTenantShopProvisioningRetryService(
  options: TenantShopProvisioningRetryOptions,
) {
  return async function retryTenantShopProvisioningAttempt(input: {
    attemptId: string;
    userId: string;
  }): Promise<TenantShopProvisioningResult> {
    const attempt = await options.findProvisioningAttemptForRetry(input.attemptId);

    if (!attempt || attempt.ownerUserId !== input.userId) {
      return {
        ok: false,
        error: "provisioning_attempt_not_found",
        status: 404,
      };
    }

    if (attempt.status !== "failed" || attempt.tenantId) {
      return {
        ok: false,
        error: "provisioning_attempt_not_retryable",
        status: 409,
      };
    }

    return options.createTenantShop({
      handle: attempt.handle,
      name: attempt.name,
      ownerUserId: input.userId,
    });
  };
}

function getRetryAttemptName(metadata: unknown, handle: string) {
  if (typeof metadata === "object" && metadata !== null && "name" in metadata) {
    const name = (metadata as { name?: unknown }).name;

    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }

  return handle;
}

export function createTenantShopProvisioningRetryServiceFromDb(options: {
  createTenantShop: TenantShopProvisioningRetryOptions["createTenantShop"];
  db: PlatformDb;
}) {
  return createTenantShopProvisioningRetryService({
    createTenantShop: options.createTenantShop,
    findProvisioningAttemptForRetry: async (attemptId) => {
      const [attempt] = await options.db
        .select({
          id: tenantProvisioningAttempts.id,
          handle: tenantProvisioningAttempts.handle,
          metadata: tenantProvisioningAttempts.metadata,
          ownerUserId: tenantProvisioningAttempts.ownerUserId,
          status: tenantProvisioningAttempts.status,
          tenantId: tenantProvisioningAttempts.tenantId,
        })
        .from(tenantProvisioningAttempts)
        .where(eq(tenantProvisioningAttempts.id, attemptId))
        .limit(1);

      if (!attempt) {
        return undefined;
      }

      return {
        id: attempt.id,
        handle: attempt.handle,
        name: getRetryAttemptName(attempt.metadata, attempt.handle),
        ownerUserId: attempt.ownerUserId,
        status: attempt.status,
        tenantId: attempt.tenantId,
      };
    },
  });
}
