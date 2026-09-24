import { loadServiceEnv } from "@ecs/config";
import {
  accounts,
  auditLogs,
  createPlatformDb,
  domains,
  platformPermissionGrants,
  platformPrincipals,
  tenants,
  users,
} from "@ecs/db";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { createMedusaCommerceProvisioningClient } from "../adapters/medusa/commerce-provisioning.js";
import { loadPlatformApiEnvFiles } from "../config/env.js";
import { PLATFORM_PERMISSIONS } from "../context/platform-authorization.js";
import { createBillingService } from "../modules/billing/service.js";
import { createStorefrontTemplateService } from "../modules/storefront/template-service.js";
import { createTenantShopProvisioningService } from "../modules/tenants/shop-provisioning.js";
import { createDemoCleanup } from "./demo-cleanup.js";
import { createDemoCommerceSeeder } from "./demo-commerce.js";
import { createDemoMediaSeeder } from "./demo-media.js";
import { createDemoMedusaClient } from "./demo-medusa-client.js";
import { seedAnalyticsEvents, seedMetrics, seedPlatformExtras } from "./demo-platform-data.js";
import {
  DEMO_OPERATIONS,
  DEMO_OPERATIONS_PASSWORD,
  DEMO_OWNER_PASSWORD,
  DEMO_SEED_MARKER,
  type DemoShopDefinition,
  afroShop,
  demoProductImages,
  demoShops,
  fashionShop,
  LEGACY_DEMO_EMAILS,
  techShop,
} from "./demo-shops.js";

loadPlatformApiEnvFiles();

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});

const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5433/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});
const demoMedia = createDemoMediaSeeder({ db: platformDb.db, env: process.env });

const medusaInternalUrl = (process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000").replace(
  /\/$/,
  "",
);
/** Resolved in main() via env → encrypted DB → bootstrap (prod leaves env empty). */
let medusaAdminApiToken = process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ?? "";
const demoMedusa = createDemoMedusaClient({
  env: process.env,
  getAdminToken: () => medusaAdminApiToken,
  medusaInternalUrl,
});
const demoCleanup = createDemoCleanup({ db: platformDb.db, medusa: demoMedusa });
const demoCommerce = createDemoCommerceSeeder({
  cleanup: demoCleanup,
  media: demoMedia,
  medusa: demoMedusa,
});
const platformInternalApiToken =
  process.env.PLATFORM_INTERNAL_API_TOKEN ??
  (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token");
const platformBaseDomain = (process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me")
  .trim()
  .replace(/\.$/, "")
  .toLowerCase();
const allowPartial =
  process.env.SEED_DEMO_ALLOW_PARTIAL !== "false" && !process.argv.includes("--strict");
const cleanOnly =
  process.argv.includes("--clean") ||
  process.argv.includes("--unseed") ||
  process.argv.includes("--reverse");
const operationsOnly = process.argv.includes("--operations-only");

function assertDemoFixtureIntegrity() {
  for (const shop of demoShops) {
    const productHandles = new Set<string>();
    const categoryHandles = new Set<string>();
    const collectionHandles = new Set<string>();

    for (const category of shop.categories) {
      if (categoryHandles.has(category.handle)) {
        throw new Error(`Duplicate demo category handle: ${category.handle}`);
      }
      categoryHandles.add(category.handle);
    }
    for (const category of shop.categories) {
      if (category.parentHandle && !categoryHandles.has(category.parentHandle)) {
        throw new Error(
          `Demo category ${category.handle} references missing parent ${category.parentHandle}`,
        );
      }
    }
    for (const collection of shop.collections) {
      if (collectionHandles.has(collection.handle)) {
        throw new Error(`Duplicate demo collection handle: ${collection.handle}`);
      }
      collectionHandles.add(collection.handle);
    }
    for (const product of shop.products) {
      if (productHandles.has(product.handle)) {
        throw new Error(`Duplicate demo product handle: ${product.handle}`);
      }
      productHandles.add(product.handle);
      if (product.categoryHandle && !categoryHandles.has(product.categoryHandle)) {
        throw new Error(
          `Demo product ${product.handle} references missing category ${product.categoryHandle}`,
        );
      }
      if (product.collectionHandle && !collectionHandles.has(product.collectionHandle)) {
        throw new Error(
          `Demo product ${product.handle} references missing collection ${product.collectionHandle}`,
        );
      }
      if (demoProductImages(product.handle).length < 2) {
        throw new Error(`Demo product ${product.handle} needs at least two curated images`);
      }
    }
  }
}

async function main() {
  if (cleanOnly) {
    const cleaned = await demoCleanup.cleanAllDemoData();
    console.log(
      JSON.stringify(
        {
          cleaned: true,
          shops: demoShops.map((shop) => shop.tenant.handle),
          summary: cleaned,
        },
        null,
        2,
      ),
    );
    console.info("[seed:demo] Demo data reversed (shops, users, catalog, metrics removed).");
    return;
  }

  if (operationsOnly) {
    const operations = await seedOperationsDemo();
    console.log(JSON.stringify({ seeded: { operations } }, null, 2));
    console.info(`
Local operations demo ready.

  Operations: http://localhost:3002
  Operator:   ${DEMO_OPERATIONS.operator.email}
  Password:   ${DEMO_OPERATIONS_PASSWORD}
`);
    return;
  }

  await ensureMedusaAdminTokenForSeed();
  if (!medusaAdminApiToken) {
    const message =
      "No Medusa admin token (env empty, DB secret missing, bootstrap failed). " +
      "Ensure Medusa is up, PLATFORM_INTERNAL_API_TOKEN matches Medusa, and platform-api has bootstrapped once — " +
      "or set MEDUSA_ADMIN_API_TOKEN / run local `pnpm seed --write-env`.";
    if (!allowPartial) throw new Error(message);
    console.warn(`[seed:demo] ${message}`);
  } else {
    const medusaReady = await preflightMedusa();
    if (!medusaReady) {
      const message = `Medusa is not reachable at ${medusaInternalUrl}.`;
      if (!allowPartial) throw new Error(message);
      console.warn(`[seed:demo] ${message}`);
    }
  }

  demoMedia.logConfig();

  // Idempotent path: do not wipe platform tenants. Refresh commerce per shop instead.
  const billing = createBillingService(platformDb.db);
  await billing.ensureDefaultPlans();
  assertDemoFixtureIntegrity();

  const provisionCommerceResources = createMedusaCommerceProvisioningClient({
    internalApiToken: platformInternalApiToken,
    medusaInternalUrl,
  });
  const createTenantShop = createTenantShopProvisioningService({
    db: platformDb.db,
    platformBaseDomain,
    provisionCommerceResources,
  });

  const results = [];

  for (const shop of demoShops) {
    const result = await seedShop(shop, createTenantShop);
    results.push(result);
  }

  const operations = await seedOperationsDemo();

  console.log(
    JSON.stringify(
      {
        seeded: {
          service: env.SERVICE_NAME,
          idempotent: true,
          password: DEMO_OWNER_PASSWORD,
          operations,
          shops: results,
        },
      },
      null,
      2,
    ),
  );

  console.info(`
Demo shops ready (safe to re-run).

  Tech shop:    http://addistech.${platformBaseDomain}/dashboard
  Owner:        ${techShop.user.email}
  Password:     ${DEMO_OWNER_PASSWORD}

  Operations:   http://localhost:3002
  Operator:     ${DEMO_OPERATIONS.operator.email}
  Password:     ${DEMO_OPERATIONS_PASSWORD}

  Fashion shop: http://${fashionShop.tenant.handle}.${platformBaseDomain}/dashboard
  Owner:        ${fashionShop.user.email}
  Password:     ${DEMO_OWNER_PASSWORD}

  Afro shop:    http://${afroShop.tenant.handle}.${platformBaseDomain}/dashboard
  Owner:        ${afroShop.user.email}
  Password:     ${DEMO_OWNER_PASSWORD}

Reverse demo data: pnpm seed:demo:clean   (or pnpm seed:unseed)
`);
}

async function seedOperationsDemo() {
  const passwordHash = await hashPassword(DEMO_OPERATIONS_PASSWORD);

  for (const identity of [DEMO_OPERATIONS.operator, DEMO_OPERATIONS.approver]) {
    await platformDb.db
      .insert(users)
      .values({
        id: identity.id,
        email: identity.email,
        emailVerified: true,
        image: null,
        name: identity.name,
        phone: null,
        status: "active",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: identity.email,
          emailVerified: true,
          name: identity.name,
          status: "active",
          updatedAt: new Date(),
        },
      });
  }

  await platformDb.db
    .insert(accounts)
    .values({
      id: `${DEMO_OPERATIONS.operator.id}:credential`,
      accountId: DEMO_OPERATIONS.operator.id,
      providerId: "credential",
      userId: DEMO_OPERATIONS.operator.id,
      password: passwordHash,
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: { password: passwordHash, updatedAt: new Date() },
    });

  await platformDb.db.transaction(async (transaction) => {
    await transaction
      .insert(platformPrincipals)
      .values({
        id: DEMO_OPERATIONS.principalId,
        userId: DEMO_OPERATIONS.operator.id,
        status: "active",
      })
      .onConflictDoUpdate({
        target: platformPrincipals.userId,
        set: { status: "active", updatedAt: new Date() },
      });

    const [principal] = await transaction
      .select({ id: platformPrincipals.id })
      .from(platformPrincipals)
      .where(eq(platformPrincipals.userId, DEMO_OPERATIONS.operator.id))
      .limit(1);
    if (!principal) throw new Error("Demo operations principal upsert returned no row");

    for (const permission of PLATFORM_PERMISSIONS) {
      await transaction
        .insert(platformPermissionGrants)
        .values({
          principalId: principal.id,
          permission,
          grantedByUserId: DEMO_OPERATIONS.approver.id,
        })
        .onConflictDoUpdate({
          target: [platformPermissionGrants.principalId, platformPermissionGrants.permission],
          set: {
            grantedByUserId: DEMO_OPERATIONS.approver.id,
            expiresAt: null,
            revokedAt: null,
          },
        });
    }

    await transaction
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.platformPrincipalId, principal.id),
          eq(auditLogs.action, "platform.demo_permissions_seeded"),
        ),
      );
    await transaction.insert(auditLogs).values({
      actorUserId: DEMO_OPERATIONS.approver.id,
      platformPrincipalId: principal.id,
      action: "platform.demo_permissions_seeded",
      targetType: "platform_principal",
      targetId: principal.id,
      metadata: {
        demo_seed: DEMO_SEED_MARKER,
        permissions: PLATFORM_PERMISSIONS,
      },
    });
  });

  return {
    email: DEMO_OPERATIONS.operator.email,
    permissions: PLATFORM_PERMISSIONS.length,
  };
}

async function seedShop(
  shop: DemoShopDefinition,
  createTenantShop: ReturnType<typeof createTenantShopProvisioningService>,
) {
  const passwordHash = await hashPassword(DEMO_OWNER_PASSWORD);

  // Rename path: stable demo tenant id may still use a legacy handle (e.g. addis-tech → addistech).
  await maybeRenameDemoTenantHandle(shop);
  await maybeRenameDemoUser(shop);

  await platformDb.db
    .insert(users)
    .values({
      id: shop.ids.user,
      email: shop.user.email,
      emailVerified: true,
      image: null,
      name: shop.user.name,
      phone: shop.user.phone,
      status: "active",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: shop.user.email,
        emailVerified: true,
        name: shop.user.name,
        phone: shop.user.phone,
        status: "active",
        updatedAt: new Date(),
      },
    });

  // Resolve actual user id (conflict update may keep existing id).
  const [userRow] = await platformDb.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, shop.user.email))
    .limit(1);
  const userId = userRow?.id ?? shop.ids.user;

  await platformDb.db
    .insert(accounts)
    .values({
      id: `${userId}:credential`,
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: {
        password: passwordHash,
        updatedAt: new Date(),
      },
    });

  const provisioned = await createTenantShop({
    handle: shop.tenant.handle,
    name: shop.tenant.name,
    ownerUserId: userId,
    platformTenantId: shop.ids.tenant,
    ...(shop.templateKey ? { templateKey: shop.templateKey } : {}),
  });

  if (!provisioned.ok) {
    const message = `Failed to provision ${shop.tenant.handle}: ${provisioned.error}`;
    if (!allowPartial) throw new Error(message);
    console.warn(`[seed:demo] ${message}`);
    return {
      handle: shop.tenant.handle,
      ok: false,
      error: provisioned.error,
    };
  }

  // Force active + stable primary domain hostname for local host routing.
  const hostname = `${shop.tenant.handle}.${platformBaseDomain}`;
  await platformDb.db
    .update(tenants)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(tenants.id, provisioned.tenant.id));

  await platformDb.db
    .update(domains)
    .set({
      status: "active",
      verificationStatus: "verified",
      sslStatus: "active",
      updatedAt: new Date(),
    })
    .where(eq(domains.hostname, hostname));

  const [tenantRow] = await platformDb.db
    .select({
      id: tenants.id,
      medusaFulfillmentSetId: tenants.medusaFulfillmentSetId,
      medusaPublishableKeyId: tenants.medusaPublishableKeyId,
      medusaRegionId: tenants.medusaRegionId,
      medusaSalesChannelId: tenants.medusaSalesChannelId,
      medusaServiceZoneId: tenants.medusaServiceZoneId,
      medusaShippingOptionId: tenants.medusaShippingOptionId,
      medusaShippingProfileId: tenants.medusaShippingProfileId,
      medusaStockLocationId: tenants.medusaStockLocationId,
      medusaStoreId: tenants.medusaStoreId,
    })
    .from(tenants)
    .where(eq(tenants.id, provisioned.tenant.id))
    .limit(1);

  const resources = demoCommerce.toCommerceResources(tenantRow);
  let commerce: Record<string, unknown> = { skipped: true, reason: "missing_commerce_resources" };

  if (resources && medusaAdminApiToken) {
    // Replace demo catalog/orders/promos for this shop only (idempotent refresh).
    await demoCleanup.cleanShopCommerce(
      shop.tenant.handle,
      provisioned.tenant.id,
      resources.salesChannelId,
    );
    commerce = await demoCommerce.seedCommerce(shop, resources, userId, provisioned.tenant.id);
  } else if (!medusaAdminApiToken) {
    commerce = { skipped: true, reason: "MEDUSA_ADMIN_API_TOKEN missing" };
  }

  // Ensure trial billing row exists (provisioning may already insert one).
  await createBillingService(platformDb.db).ensureTrialSubscription({
    tenantId: provisioned.tenant.id,
  });
  await seedMetrics(
    platformDb.db,
    provisioned.tenant.id,
    shop.products.length,
    shop.customers.length,
  );
  await seedAnalyticsEvents(platformDb.db, provisioned.tenant.id, shop);
  const platformExtras = await seedPlatformExtras(
    platformDb.db,
    shop,
    provisioned.tenant.id,
    userId,
    commerce,
  );

  // Publish demo storefront draft so the live storefront is immediately reachable
  const storefrontTemplateService = createStorefrontTemplateService(platformDb.db);
  if (shop.templateKey) {
    await storefrontTemplateService.selectStorefrontTemplate({
      tenantId: provisioned.tenant.id,
      templateKey: shop.templateKey,
      mode: "clean",
      userId,
    });
  }
  await storefrontTemplateService.publishStorefrontDraft({
    tenantId: provisioned.tenant.id,
    userId,
  });

  return {
    handle: shop.tenant.handle,
    ok: true,
    tenantId: provisioned.tenant.id,
    domain: hostname,
    user: shop.user.email,
    dashboard: `http://${hostname}/dashboard`,
    commerce,
    platform: platformExtras,
  };
}

async function preflightMedusa() {
  try {
    const response = await fetch(`${medusaInternalUrl}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Prod leaves MEDUSA_ADMIN_API_TOKEN empty; token lives in platform_system_secrets
 * after platform-api bootstrap. Seed must use the same resolution path.
 */
async function ensureMedusaAdminTokenForSeed() {
  if (medusaAdminApiToken) {
    console.info(
      `[seed:demo] Using MEDUSA_ADMIN_API_TOKEN from env (fingerprint …${medusaAdminApiToken.slice(-4)})`,
    );
    return;
  }

  const result = await resolveMedusaAdminToken({
    db: platformDb.db,
    medusaInternalUrl,
    internalApiToken: platformInternalApiToken,
    envToken: process.env.MEDUSA_ADMIN_API_TOKEN,
    logger: {
      info: (fields, msg) => console.info(`[seed:demo] ${msg}`, fields),
      warn: (fields, msg) => console.warn(`[seed:demo] ${msg}`, fields),
      error: (fields, msg) => console.error(`[seed:demo] ${msg}`, fields),
    },
  });

  if (result.ok) {
    medusaAdminApiToken = result.token;
    console.info(
      `[seed:demo] Medusa admin token ready (source=${result.source}, fingerprint …${result.token.slice(-4)})`,
    );
    return;
  }

  console.warn(`[seed:demo] Could not resolve Medusa admin token: ${result.error}`);
}

/** Keep stable demo user IDs when the owner email changes. */
async function maybeRenameDemoUser(shop: DemoShopDefinition) {
  const [byId] = await platformDb.db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, shop.ids.user))
    .limit(1);

  if (byId && byId.email !== shop.user.email) {
    // Free the new email if a stray row owns it.
    const [emailOwner] = await platformDb.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, shop.user.email))
      .limit(1);
    if (emailOwner && emailOwner.id !== shop.ids.user) {
      await platformDb.db.delete(accounts).where(eq(accounts.userId, emailOwner.id));
      await platformDb.db.delete(users).where(eq(users.id, emailOwner.id));
    }
    await platformDb.db
      .update(users)
      .set({
        email: shop.user.email,
        name: shop.user.name,
        phone: shop.user.phone,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, shop.ids.user));
    console.info(`[seed:demo] Renamed demo owner ${byId.email} → ${shop.user.email}`);
  }

  // Drop legacy emails that no longer map to fixtures (e.g. owner@addis-tech.local).
  for (const legacyEmail of LEGACY_DEMO_EMAILS) {
    if (legacyEmail === shop.user.email) continue;
    const [legacy] = await platformDb.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, legacyEmail))
      .limit(1);
    if (!legacy || legacy.id === shop.ids.user) continue;
    await platformDb.db.delete(accounts).where(eq(accounts.userId, legacy.id));
    await platformDb.db.delete(users).where(eq(users.id, legacy.id));
  }
}

/** Keep stable demo tenant IDs when the public handle changes. */
async function maybeRenameDemoTenantHandle(shop: DemoShopDefinition) {
  const [existing] = await platformDb.db
    .select({ id: tenants.id, handle: tenants.handle })
    .from(tenants)
    .where(eq(tenants.id, shop.ids.tenant))
    .limit(1);
  if (!existing || existing.handle === shop.tenant.handle) return;

  const hostname = `${shop.tenant.handle}.${platformBaseDomain}`;
  const taken = await platformDb.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.handle, shop.tenant.handle))
    .limit(1);
  if (taken[0] && taken[0].id !== shop.ids.tenant) {
    console.warn(
      `[seed:demo] Cannot rename ${existing.handle} → ${shop.tenant.handle}: handle already used by ${taken[0].id}`,
    );
    return;
  }

  await platformDb.db
    .update(tenants)
    .set({
      handle: shop.tenant.handle,
      name: shop.tenant.name,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, shop.ids.tenant));

  await platformDb.db
    .update(domains)
    .set({
      hostname,
      status: "active",
      verificationStatus: "verified",
      sslStatus: "active",
      updatedAt: new Date(),
    })
    .where(and(eq(domains.tenantId, shop.ids.tenant), eq(domains.isPrimary, true)));

  console.info(
    `[seed:demo] Renamed demo tenant handle ${existing.handle} → ${shop.tenant.handle} (${hostname})`,
  );
}

try {
  await main();
} finally {
  await platformDb.pool.end();
}
