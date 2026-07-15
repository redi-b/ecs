import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  domains,
  invoices,
  plans,
  reservedHandles,
  storefrontConfigs,
  storefrontTemplates,
  storefrontTemplateVersions,
  subscriptions,
  tenantMemberships,
  tenantOnboarding,
  tenantProvisioningAttempts,
  tenants,
} from "@ecs/db";
import { DEFAULT_PLAN_IDS } from "../billing/service.js";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type {
  CommerceProvisioningInput,
  CommerceProvisioningResult,
} from "../../adapters/medusa/commerce-provisioning.js";
import type {
  TenantProvisioningAttemptListResult,
  TenantShopProvisioningResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type ExistingTenantShop = {
  createdAt: Date;
  id: string;
  name: string;
  handle: string;
  status: string;
  primaryDomainHostname: string | null;
  ownerUserId: string | null;
  updatedAt: Date;
};

type ActiveStorefrontTemplate = {
  templateId: string;
  templateVersion: number;
  defaultData: unknown;
  defaultThemeTokens: unknown;
};

type CreatedTenantShop = {
  createdAt: string;
  id: string;
  name: string;
  handle: string;
  role: "owner";
  status: string;
  primaryDomain: {
    hostname: string;
  };
  updatedAt: string;
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
  findActiveStorefrontTemplate: (input?: {
    templateId?: string | undefined;
    templateKey?: string | undefined;
  }) => Promise<ActiveStorefrontTemplate | undefined>;
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
    templateId?: string | null | undefined;
    templateKey?: string | null | undefined;
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
    platformTenantId?: string | undefined;
    templateId?: string | undefined;
    templateKey?: string | undefined;
  }) => Promise<TenantShopProvisioningResult>;
  findProvisioningAttemptForRetry: (attemptId: string) => Promise<
    | {
        handle: string;
        id: string;
        metadata: unknown;
        name: string;
        ownerUserId: string;
        platformTenantId: string;
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
    templateId?: string | null | undefined;
    templateKey?: string | null | undefined;
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
    platformTenantId?: string | undefined;
    templateId?: string | undefined;
    templateKey?: string | undefined;
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
            createdAt: existingTenant.createdAt.toISOString(),
            id: existingTenant.id,
            name: existingTenant.name,
            handle: existingTenant.handle,
            role: "owner",
            status: existingTenant.status,
            primaryDomain: {
              hostname: existingTenant.primaryDomainHostname,
            },
            updatedAt: existingTenant.updatedAt.toISOString(),
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

    const tenantId = input.platformTenantId ?? crypto.randomUUID();
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
        ...(input.templateId ? { templateId: input.templateId } : {}),
        ...(input.templateKey ? { templateKey: input.templateKey } : {}),
        tenantId: null,
      });

      return {
        ok: false,
        error: commerceResources.error,
        status: 503,
      };
    }

    const activeTemplate = await options.findActiveStorefrontTemplate({
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.templateKey ? { templateKey: input.templateKey } : {}),
    });

    if (!activeTemplate) {
      await recordProvisioningAttempt(options.recordProvisioningAttempt, {
        error: "storefront_template_unavailable",
        handle,
        name,
        ownerUserId: input.ownerUserId,
        platformTenantId: tenantId,
        status: "failed",
        step: "storefront_template",
        ...(input.templateId ? { templateId: input.templateId } : {}),
        ...(input.templateKey ? { templateKey: input.templateKey } : {}),
        tenantId: null,
      });

      return {
        ok: false,
        error:
          input.templateId || input.templateKey
            ? "template_unavailable"
            : "storefront_template_unavailable",
        status: input.templateId || input.templateKey ? 400 : 503,
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
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.templateKey ? { templateKey: input.templateKey } : {}),
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
            createdAt: tenants.createdAt,
            id: tenants.id,
            name: tenants.name,
            handle: tenants.handle,
            status: tenants.status,
            updatedAt: tenants.updatedAt,
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

        // Ensure default plans exist, then attach a 14-day Starter trial.
        await transaction
          .insert(plans)
          .values({
            id: DEFAULT_PLAN_IDS.starter,
            name: "Starter",
            price: "0",
            status: "active",
            limits: { products: 100, staff: 2, storefrontEvents: 10_000 },
            features: { analytics: true, managedCheckout: true, trial: true },
          })
          .onConflictDoNothing({ target: plans.id });

        await transaction
          .insert(plans)
          .values({
            id: DEFAULT_PLAN_IDS.growth,
            name: "Growth",
            price: "2499",
            status: "active",
            limits: { products: 2500, staff: 8, storefrontEvents: 100_000 },
            features: { analytics: true, managedCheckout: true, localDelivery: true },
          })
          .onConflictDoNothing({ target: plans.id });

        // Free forever Starter — no trial expiry, no payment invoices.
        const freeStart = new Date();
        await transaction.insert(subscriptions).values({
          tenantId,
          planId: DEFAULT_PLAN_IDS.starter,
          status: "active",
          billingCycle: "monthly",
          currentPeriodStart: freeStart,
          currentPeriodEnd: null,
          manualPaymentState: "none",
        });

        return {
          ...createdTenantRow,
          primaryDomain: primaryDomainRow,
        };
      });

      return {
        createdAt: tenant.createdAt.toISOString(),
        id: tenant.id,
        name: tenant.name,
        handle: tenant.handle,
        role: "owner",
        status: tenant.status,
        primaryDomain: {
          hostname: tenant.primaryDomain.hostname,
        },
        updatedAt: tenant.updatedAt.toISOString(),
      };
    },
    findActiveStorefrontTemplate: async (input) => {
      const filters = [
        eq(storefrontTemplates.status, "active"),
        eq(storefrontTemplateVersions.status, "active"),
      ];

      if (input?.templateId?.trim()) {
        filters.push(eq(storefrontTemplates.id, input.templateId.trim()));
      }

      if (input?.templateKey?.trim()) {
        filters.push(eq(storefrontTemplateVersions.templateKey, input.templateKey.trim()));
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
        .where(and(...filters))
        .orderBy(asc(storefrontTemplates.sortOrder), desc(storefrontTemplateVersions.version))
        .limit(1);

      return activeTemplate;
    },
    findExistingTenantByHandle: async (handle, ownerUserId) => {
      const [existingTenant] = await options.db
        .select({
          createdAt: tenants.createdAt,
          id: tenants.id,
          name: tenants.name,
          handle: tenants.handle,
          status: tenants.status,
          primaryDomainHostname: domains.hostname,
          ownerUserId: tenantMemberships.userId,
          updatedAt: tenants.updatedAt,
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
          templateId: "templateId" in input ? (input.templateId ?? null) : null,
          templateKey: "templateKey" in input ? (input.templateKey ?? null) : null,
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

    const templateId = getRetryAttemptTemplateId(attempt.metadata);
    const templateKey = getRetryAttemptTemplateKey(attempt.metadata);

    return options.createTenantShop({
      handle: attempt.handle,
      name: attempt.name,
      ownerUserId: input.userId,
      platformTenantId: attempt.platformTenantId,
      ...(templateId ? { templateId } : {}),
      ...(templateKey ? { templateKey } : {}),
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

function getRetryAttemptTemplateId(metadata: unknown) {
  if (typeof metadata === "object" && metadata !== null && "templateId" in metadata) {
    const templateId = (metadata as { templateId?: unknown }).templateId;

    if (typeof templateId === "string" && templateId.trim()) {
      return templateId;
    }
  }

  return undefined;
}

function getRetryAttemptTemplateKey(metadata: unknown) {
  if (typeof metadata === "object" && metadata !== null && "templateKey" in metadata) {
    const templateKey = (metadata as { templateKey?: unknown }).templateKey;

    if (typeof templateKey === "string" && templateKey.trim()) {
      return templateKey;
    }
  }

  return undefined;
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
          platformTenantId: tenantProvisioningAttempts.platformTenantId,
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
        metadata: attempt.metadata,
        name: getRetryAttemptName(attempt.metadata, attempt.handle),
        ownerUserId: attempt.ownerUserId,
        platformTenantId: attempt.platformTenantId,
        status: attempt.status,
        tenantId: attempt.tenantId,
      };
    },
  });
}

export function createTenantProvisioningAttemptListService(db: PlatformDb) {
  return async function listTenantProvisioningAttempts(input: {
    limit: number;
    offset: number;
    userId: string;
  }): Promise<TenantProvisioningAttemptListResult> {
    const rows = await db
      .select({
        id: tenantProvisioningAttempts.id,
        completedAt: tenantProvisioningAttempts.completedAt,
        createdAt: tenantProvisioningAttempts.createdAt,
        error: tenantProvisioningAttempts.error,
        handle: tenantProvisioningAttempts.handle,
        metadata: tenantProvisioningAttempts.metadata,
        platformTenantId: tenantProvisioningAttempts.platformTenantId,
        status: tenantProvisioningAttempts.status,
        step: tenantProvisioningAttempts.step,
        tenantId: tenantProvisioningAttempts.tenantId,
      })
      .from(tenantProvisioningAttempts)
      .where(eq(tenantProvisioningAttempts.ownerUserId, input.userId))
      .orderBy(desc(tenantProvisioningAttempts.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const [total] = await db
      .select({
        count: count(),
      })
      .from(tenantProvisioningAttempts)
      .where(eq(tenantProvisioningAttempts.ownerUserId, input.userId));

    return {
      ok: true,
      attempts: rows.map((row) => ({
        id: row.id,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        error: row.error,
        handle: row.handle,
        name: getRetryAttemptName(row.metadata, row.handle),
        platformTenantId: row.platformTenantId,
        status: row.status,
        step: row.step,
        tenantId: row.tenantId,
      })),
      count: total?.count ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  };
}
