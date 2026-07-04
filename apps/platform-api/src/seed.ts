import { loadServiceEnv, loadServiceEnvFiles } from "@ecs/config";
import {
  accounts,
  createPlatformDb,
  domains,
  storefrontConfigs,
  storefrontRevisions,
  storefrontTemplates as storefrontTemplateRows,
  storefrontTemplateVersions,
  tenantMemberships,
  tenantOnboarding,
  tenants,
  users,
} from "@ecs/db";
import { storefrontTemplates } from "@ecs/storefront-templates";
import { hashPassword } from "better-auth/crypto";

import { buildPlatformSeed } from "./seed-data.js";

loadServiceEnvFiles();

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});

const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});

const seed = buildPlatformSeed({
  storefrontBaseDomain: process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me",
  medusaPublishableKeyId: process.env.SEED_MEDUSA_PUBLISHABLE_KEY_ID ?? "pk_test_local_abebe",
  templates: storefrontTemplates,
});
const seedOwnerPassword = process.env.SEED_OWNER_PASSWORD ?? "password1234";

try {
  const [template] = seed.templates;
  const [templateVersion] = seed.templateVersions;

  if (!template || !templateVersion) {
    throw new Error("Platform seed data did not include a storefront template.");
  }

  await platformDb.db
    .insert(storefrontTemplateRows)
    .values(template)
    .onConflictDoUpdate({
      target: storefrontTemplateRows.slug,
      set: {
        name: template.name,
        description: template.description,
        status: template.status,
        tags: template.tags,
        sortOrder: template.sortOrder,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(storefrontTemplateVersions)
    .values(templateVersion)
    .onConflictDoUpdate({
      target: storefrontTemplateVersions.templateKey,
      set: {
        templateId: templateVersion.templateId,
        version: templateVersion.version,
        schema: templateVersion.schema,
        defaultData: templateVersion.defaultData,
        defaultThemeTokens: templateVersion.defaultThemeTokens,
        previewData: templateVersion.previewData,
        componentRegistryVersion: templateVersion.componentRegistryVersion,
        sourceHash: templateVersion.sourceHash,
        status: templateVersion.status,
      },
    });

  await platformDb.db
    .insert(tenants)
    .values(seed.tenant)
    .onConflictDoUpdate({
      target: tenants.handle,
      set: {
        name: seed.tenant.name,
        status: seed.tenant.status,
        primaryDomainId: seed.tenant.primaryDomainId,
        medusaStoreId: seed.tenant.medusaStoreId,
        medusaSalesChannelId: seed.tenant.medusaSalesChannelId,
        medusaPublishableKeyId: seed.tenant.medusaPublishableKeyId,
        medusaStockLocationId: seed.tenant.medusaStockLocationId,
        medusaRegionId: seed.tenant.medusaRegionId,
        medusaShippingProfileId: seed.tenant.medusaShippingProfileId,
        medusaFulfillmentSetId: seed.tenant.medusaFulfillmentSetId,
        medusaServiceZoneId: seed.tenant.medusaServiceZoneId,
        medusaShippingOptionId: seed.tenant.medusaShippingOptionId,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(domains)
    .values(seed.domain)
    .onConflictDoUpdate({
      target: domains.hostname,
      set: {
        tenantId: seed.domain.tenantId,
        type: seed.domain.type,
        status: seed.domain.status,
        isPrimary: seed.domain.isPrimary,
        verificationStatus: seed.domain.verificationStatus,
        sslStatus: seed.domain.sslStatus,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(users)
    .values(seed.user)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        emailVerified: seed.user.emailVerified,
        image: seed.user.image,
        phone: seed.user.phone,
        name: seed.user.name,
        status: seed.user.status,
        updatedAt: new Date(),
      },
    });

  const passwordHash = await hashPassword(seedOwnerPassword);

  await platformDb.db
    .insert(accounts)
    .values({
      id: `${seed.user.id}:credential`,
      accountId: seed.user.id,
      providerId: "credential",
      userId: seed.user.id,
      password: passwordHash,
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: {
        accountId: seed.user.id,
        providerId: "credential",
        userId: seed.user.id,
        password: passwordHash,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(tenantMemberships)
    .values(seed.tenantMembership)
    .onConflictDoUpdate({
      target: tenantMemberships.id,
      set: {
        tenantId: seed.tenantMembership.tenantId,
        userId: seed.tenantMembership.userId,
        role: seed.tenantMembership.role,
        status: seed.tenantMembership.status,
      },
    });

  await platformDb.db
    .insert(tenantOnboarding)
    .values(seed.tenantOnboarding)
    .onConflictDoUpdate({
      target: tenantOnboarding.tenantId,
      set: {
        status: seed.tenantOnboarding.status,
        currentStep: seed.tenantOnboarding.currentStep,
        completedSteps: seed.tenantOnboarding.completedSteps,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(storefrontRevisions)
    .values(seed.storefrontRevision)
    .onConflictDoUpdate({
      target: storefrontRevisions.id,
      set: {
        tenantId: seed.storefrontRevision.tenantId,
        templateId: seed.storefrontRevision.templateId,
        templateVersion: seed.storefrontRevision.templateVersion,
        templateKey: seed.storefrontRevision.templateKey,
        data: seed.storefrontRevision.data,
        themeTokens: seed.storefrontRevision.themeTokens,
      },
    });

  await platformDb.db
    .insert(storefrontConfigs)
    .values(seed.storefrontConfig)
    .onConflictDoUpdate({
      target: storefrontConfigs.id,
      set: {
        tenantId: seed.storefrontConfig.tenantId,
        draftTemplateId: seed.storefrontConfig.draftTemplateId,
        draftTemplateVersion: seed.storefrontConfig.draftTemplateVersion,
        draftData: seed.storefrontConfig.draftData,
        draftThemeTokens: seed.storefrontConfig.draftThemeTokens,
        publishedRevisionId: seed.storefrontConfig.publishedRevisionId,
        publishedAt: seed.storefrontConfig.publishedAt,
        updatedAt: new Date(),
      },
    });

  console.log(
    JSON.stringify(
      {
        seeded: {
          service: env.SERVICE_NAME,
          tenant: seed.tenant.handle,
          domain: seed.domain.hostname,
          user: seed.user.email,
          templates: seed.templateVersions.map((version) => version.templateKey),
        },
      },
      null,
      2,
    ),
  );
} finally {
  await platformDb.pool.end();
}
