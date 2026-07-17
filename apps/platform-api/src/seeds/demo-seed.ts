/**
 * Demo seed: two shops (tech + fashion), separate owners, real Medusa commerce.
 *
 * Idempotent: re-running `pnpm seed:demo` refreshes catalog/metrics without
 * requiring a wipe first. Users/tenants are upserted; commerce demo data is
 * replaced for those shops only.
 *
 * Reverse / unseed:
 *   pnpm seed:demo:clean
 *   pnpm seed:unseed
 *   pnpm seed:demo --clean
 *
 *   pnpm seed:demo --strict   # fail if Medusa commerce is incomplete
 *
 * Prerequisites: Medusa + platform DB + media storage running.
 *
 * Medusa admin token resolution (same as platform-api runtime):
 *   1. MEDUSA_ADMIN_API_TOKEN env (optional override)
 *   2. Encrypted platform_system_secrets (prod auto-bootstrap)
 *   3. Internal bootstrap via PLATFORM_INTERNAL_API_TOKEN
 *
 * Media uploads (server-side PutObject):
 *   Prefer MEDIA_S3_INTERNAL_ENDPOINT (e.g. http://seaweedfs:8333 in Docker)
 *   for S3 API; MEDIA_S3_PUBLIC_BASE_URL still builds browser-facing URLs.
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadServiceEnv } from "@ecs/config";
import {
  accounts,
  analyticsEvents,
  createPlatformDb,
  dailyMetrics,
  deliverySettings,
  domains,
  inAppNotifications,
  invoices,
  mediaAssets,
  mediaUsages,
  notificationDestinations,
  notificationLogs,
  notificationPreferences,
  operatorNotes,
  paymentOnboarding,
  storefrontConfigs,
  storefrontRevisions,
  subscriptions,
  telegramConnectSessions,
  tenantMemberships,
  tenantOnboarding,
  tenantProvisioningAttempts,
  tenants,
  users,
} from "@ecs/db";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";

import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { createMedusaCommerceProvisioningClient } from "../adapters/medusa/commerce-provisioning.js";
import { getPlatformApiServiceDir, loadPlatformApiEnvFiles } from "../config/env.js";
import { DEFAULT_PLAN_IDS, createBillingService } from "../modules/billing/service.js";
import { createTenantShopProvisioningService } from "../modules/tenants/shop-provisioning.js";
import {
  DEMO_OWNER_PASSWORD,
  DEMO_SEED_MARKER,
  LEGACY_DEMO_EMAILS,
  LEGACY_DEMO_HANDLES,
  type DemoProduct,
  type DemoShopDefinition,
  demoImageUrl,
  demoShops,
} from "./demo-shops.js";

loadPlatformApiEnvFiles();

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

const medusaInternalUrl = (process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000").replace(
  /\/$/,
  "",
);
/** Resolved in main() via env → encrypted DB → bootstrap (prod leaves env empty). */
let medusaAdminApiToken = process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ?? "";
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

type CommerceResources = {
  fulfillmentSetId: string;
  publishableKeyId: string;
  regionId: string;
  salesChannelId: string;
  serviceZoneId: string;
  shippingOptionId: string;
  shippingProfileId: string;
  stockLocationId: string;
  storeId: string;
};

type ProductSeedResult = {
  id: string;
  title: string;
  variants?: Array<{ id: string; title: string; sku?: string | null }>;
};

/** 1×1 PNG used when picsum is unreachable (offline / CI). */
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const DEMO_NOTIFICATION_EVENTS = [
  "order.created",
  "order.cancelled",
  "order.confirmed",
  "order.ready",
  "order.out_for_delivery",
  "order.delivered",
  "payment.paid",
  "payment.failed",
  "inventory.low",
] as const;

async function main() {
  if (cleanOnly) {
    const cleaned = await cleanAllDemoData();
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

  logMediaSeedConfig();

  // Idempotent path: do not wipe platform tenants. Refresh commerce per shop instead.
  const billing = createBillingService(platformDb.db);
  await billing.ensureDefaultPlans();

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

  console.log(
    JSON.stringify(
      {
        seeded: {
          service: env.SERVICE_NAME,
          idempotent: true,
          password: DEMO_OWNER_PASSWORD,
          shops: results,
        },
      },
      null,
      2,
    ),
  );

  console.info(`
Demo shops ready (safe to re-run).

  Tech shop:    http://addistech.${platformBaseDomain}/admin
  Owner:        owner@addistech.local
  Password:     ${DEMO_OWNER_PASSWORD}

  Fashion shop: http://bole-style.${platformBaseDomain}/admin
  Owner:        owner@bole-style.local
  Password:     ${DEMO_OWNER_PASSWORD}

Reverse demo data: pnpm seed:demo:clean   (or pnpm seed:unseed)
`);
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

  const resources = toCommerceResources(tenantRow);
  let commerce: Record<string, unknown> = { skipped: true, reason: "missing_commerce_resources" };

  if (resources && medusaAdminApiToken) {
    // Replace demo catalog/orders/promos for this shop only (idempotent refresh).
    await cleanShopCommerce(shop.tenant.handle, provisioned.tenant.id, resources.salesChannelId);
    commerce = await seedCommerce(shop, resources, userId, provisioned.tenant.id);
  } else if (!medusaAdminApiToken) {
    commerce = { skipped: true, reason: "MEDUSA_ADMIN_API_TOKEN missing" };
  }

  await seedMetrics(provisioned.tenant.id);
  await seedAnalyticsEvents(provisioned.tenant.id, shop.tenant.handle);
  const platformExtras = await seedPlatformExtras(shop, provisioned.tenant.id, userId, commerce);

  // Ensure trial billing row exists (provisioning may already insert one).
  await createBillingService(platformDb.db).ensureTrialSubscription({
    tenantId: provisioned.tenant.id,
  });

  return {
    handle: shop.tenant.handle,
    ok: true,
    tenantId: provisioned.tenant.id,
    domain: hostname,
    user: shop.user.email,
    dashboard: `http://${hostname}/admin`,
    commerce,
    platform: platformExtras,
  };
}

function toCommerceResources(
  row:
    | {
        medusaFulfillmentSetId: string | null;
        medusaPublishableKeyId: string | null;
        medusaRegionId: string | null;
        medusaSalesChannelId: string | null;
        medusaServiceZoneId: string | null;
        medusaShippingOptionId: string | null;
        medusaShippingProfileId: string | null;
        medusaStockLocationId: string | null;
        medusaStoreId: string | null;
      }
    | undefined,
): CommerceResources | null {
  if (
    !row?.medusaStoreId ||
    !row.medusaSalesChannelId ||
    !row.medusaRegionId ||
    !row.medusaShippingProfileId ||
    !row.medusaStockLocationId ||
    !row.medusaPublishableKeyId ||
    !row.medusaFulfillmentSetId ||
    !row.medusaServiceZoneId ||
    !row.medusaShippingOptionId
  ) {
    return null;
  }

  return {
    storeId: row.medusaStoreId,
    salesChannelId: row.medusaSalesChannelId,
    regionId: row.medusaRegionId,
    shippingProfileId: row.medusaShippingProfileId,
    stockLocationId: row.medusaStockLocationId,
    publishableKeyId: row.medusaPublishableKeyId,
    fulfillmentSetId: row.medusaFulfillmentSetId,
    serviceZoneId: row.medusaServiceZoneId,
    shippingOptionId: row.medusaShippingOptionId,
  };
}

async function seedCommerce(
  shop: DemoShopDefinition,
  resources: CommerceResources,
  userId: string,
  tenantId: string,
) {
  const metadata = {
    demo_seed: DEMO_SEED_MARKER,
    platform_tenant_id: tenantId,
    shop_handle: shop.tenant.handle,
  };

  // Nested categories: parents first, then children with parent_category_id.
  const categoryByHandle = new Map<string, { id: string; name: string }>();
  const roots = shop.categories.filter((category) => !category.parentHandle);
  const children = shop.categories.filter((category) => category.parentHandle);
  for (const category of [...roots, ...children]) {
    const parentId = category.parentHandle
      ? categoryByHandle.get(category.parentHandle)?.id
      : undefined;
    const result = await medusaPost<{ product_category?: { id: string; name: string } }>(
      "/admin/product-categories",
      {
        handle: category.handle,
        is_active: true,
        is_internal: false,
        metadata,
        name: category.name,
        ...(parentId ? { parent_category_id: parentId } : {}),
      },
    );
    if (result?.product_category) {
      categoryByHandle.set(category.handle, result.product_category);
    }
  }
  const categories = [...categoryByHandle.values()];

  const collectionByHandle = new Map<string, { id: string; title: string }>();
  for (const collection of shop.collections) {
    const result = await medusaPost<{ collection?: { id: string; title: string } }>(
      "/admin/collections",
      {
        handle: collection.handle,
        metadata,
        title: collection.title,
      },
    );
    if (result?.collection) {
      collectionByHandle.set(collection.handle, result.collection);
    }
  }
  const collections = [...collectionByHandle.values()];

  // Wipe prior demo media for this tenant so re-seed refreshes Seaweed + library.
  await resetTenantDemoMedia(tenantId);

  const products: ProductSeedResult[] = [];
  let mediaAssetsCreated = 0;
  let variantsStocked = 0;

  for (const [index, product] of shop.products.entries()) {
    const category =
      (product.categoryHandle
        ? categoryByHandle.get(product.categoryHandle)
        : undefined) ?? categories[index % Math.max(categories.length, 1)];
    const collection =
      (product.collectionHandle
        ? collectionByHandle.get(product.collectionHandle)
        : undefined) ?? collections[index % Math.max(collections.length, 1)];

    const imageCount = product.imageCount ?? 2;
    const uploaded = await seedProductMediaAssets({
      imageCategory: product.imageCategory,
      imageCount,
      productHandle: product.handle,
      productTitle: product.title,
      tenantId,
      userId,
    });
    mediaAssetsCreated += uploaded.length;
    const imageUrls = uploaded.map((asset) => asset.publicUrl).filter(Boolean) as string[];
    // Fallback remote URLs if Seaweed is down so products still get thumbnails.
    if (!imageUrls.length) {
      for (let i = 0; i < imageCount; i += 1) {
        imageUrls.push(demoImageUrl(product.imageCategory, i));
      }
    }
    const thumbnail = imageUrls[0] ?? demoImageUrl(product.imageCategory, 0);

    const result = await medusaPost<{ product?: ProductSeedResult }>("/admin/products", {
      categories: category ? [{ id: category.id }] : [],
      collection_id: collection?.id,
      description: product.description,
      handle: product.handle,
      images: imageUrls.map((url) => ({ url })),
      metadata,
      options: product.options.map((option) => ({
        title: option.title,
        values: [...option.values],
      })),
      sales_channels: [{ id: resources.salesChannelId }],
      shipping_profile_id: resources.shippingProfileId,
      status: "published",
      thumbnail,
      title: product.title,
      variants: product.variants.map((variant) => ({
        manage_inventory: true,
        options: variant.options,
        prices: [{ amount: variant.price, currency_code: "etb" }],
        // Prefix SKUs with tenant short id so re-seeds after soft-delete do not collide.
        sku: `${tenantId.slice(0, 8)}_${variant.sku}`.slice(0, 64),
        title: variant.title ?? `${product.title} / ${Object.values(variant.options).join(" / ")}`,
      })),
    });

    if (result?.product?.id) {
      // Create response may omit variants; re-fetch so orders can use variant ids.
      const detailed = await medusaGet<{ product?: ProductSeedResult }>(
        `/admin/products/${encodeURIComponent(result.product.id)}?fields=id,title,variants.id,variants.title,variants.sku`,
      );
      const seededProduct = detailed?.product ?? result.product;
      products.push(seededProduct);
      variantsStocked += await seedProductStock(result.product.id, resources, product);
      if (uploaded.length) {
        await linkMediaUsages({
          assets: uploaded,
          productId: result.product.id,
          tenantId,
          thumbnailUrl: thumbnail,
        });
      }
    }
  }

  // Customers must join this shop's tenant group or they won't appear in the dashboard list.
  const customerGroupId = await ensureTenantCustomerGroup(tenantId, shop.tenant.handle);
  const customerIds: string[] = [];
  let customersCreated = 0;

  for (const customer of shop.customers) {
    const customerId = await ensureDemoCustomer(customer, metadata, customerGroupId);
    if (!customerId) continue;
    customerIds.push(customerId);
    customersCreated += 1;
  }

  // Promotions (tenant-scoped via campaign_identifier prefix used by platform API)
  await cleanTenantPromotions(tenantId, shop.tenant.handle);
  const promotionsCreated = await seedPromotions(tenantId, shop.tenant.handle, products);

  const orderSummary = await seedDemoOrders({
    customerIds,
    metadata,
    products,
    resources,
    shop,
  });

  return {
    skipped: false,
    categories: categories.length,
    collections: collections.length,
    products: products.length,
    variantsStocked,
    mediaAssets: mediaAssetsCreated,
    customers: customersCreated,
    promotions: promotionsCreated,
    orders: orderSummary.orders,
    drafts: orderSummary.drafts,
    cancelled: orderSummary.cancelled,
    completed: orderSummary.completed,
    createdBy: userId,
  };
}

async function seedDemoOrders(input: {
  customerIds: string[];
  metadata: Record<string, string>;
  products: ProductSeedResult[];
  resources: CommerceResources;
  shop: DemoShopDefinition;
}) {
  const { customerIds, metadata, products, resources, shop } = input;
  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      productTitle: product.title,
      variantId: variant.id,
    })),
  );

  let orders = 0;
  let drafts = 0;
  let cancelled = 0;
  let completed = 0;
  const orderCount = Math.min(14, Math.max(shop.customers.length * 2, 6), Math.max(variants.length, 1));
  const orderIdsToBackdate: Array<{ id: string; createdAt: Date }> = [];

  for (let index = 0; index < orderCount; index += 1) {
    const primary = variants[index % variants.length];
    const secondary = variants[(index + 3) % variants.length];
    const customer = shop.customers[index % shop.customers.length];
    if (!primary || !customer) continue;

    const daysAgo = Math.min(34, Math.round((index / Math.max(orderCount - 1, 1)) * 34));
    const placedAt = addDays(new Date(), -daysAgo);
    placedAt.setUTCHours(9 + (index % 9), (index * 11) % 60, index % 60, 0);

    const items = [
      {
        quantity: (index % 3) + 1,
        variant_id: primary.variantId,
      },
    ];
    // Multi-line on most orders for a richer list/detail UI.
    if (secondary && secondary.variantId !== primary.variantId && index % 3 !== 0) {
      items.push({
        quantity: 1 + (index % 2),
        variant_id: secondary.variantId,
      });
    }

    const draft = await medusaPost<{ draft_order?: { id: string }; order?: { id: string } }>(
      "/admin/draft-orders",
      {
        billing_address: demoAddress(customer),
        email: customer.email,
        ...(customerIds[index % customerIds.length]
          ? { customer_id: customerIds[index % customerIds.length] }
          : {}),
        items,
        metadata: {
          ...metadata,
          created_from: "demo_seed",
          checkout_type: "cod",
          payment_method: "cod",
          delivery_choice: index % 3 === 0 ? "pickup" : "delivery",
          customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
          customer_phone: customer.phone,
          note:
            index % 5 === 0
              ? "Please call before delivery — demo note"
              : "Demo cash order",
          demo_placed_at: placedAt.toISOString(),
        },
        region_id: resources.regionId,
        sales_channel_id: resources.salesChannelId,
        shipping_address: demoAddress(customer),
      },
    );

    const draftId = draft?.draft_order?.id ?? draft?.order?.id;
    if (!draftId) continue;

    // Leave every 5th as an open draft; convert the rest.
    if (index % 5 === 4) {
      await backdateMedusaDraftOrder(draftId, placedAt);
      drafts += 1;
      orders += 1;
      continue;
    }

    const converted = await medusaPost<{ order?: { id: string } }>(
      `/admin/draft-orders/${encodeURIComponent(draftId)}/convert-to-order`,
      {},
    );
    const orderId = converted?.order?.id;
    if (!orderId) continue;

    orderIdsToBackdate.push({ id: orderId, createdAt: placedAt });
    orders += 1;

    // Status mix: cancel some, complete some; rest stay open.
    if (index % 7 === 1) {
      const cancelledOk = await medusaPost(
        `/admin/orders/${encodeURIComponent(orderId)}/cancel`,
        {},
      );
      if (cancelledOk) cancelled += 1;
    } else if (index % 4 === 0) {
      const completedOk = await medusaPost(
        `/admin/orders/${encodeURIComponent(orderId)}/complete`,
        {},
      );
      if (completedOk) completed += 1;
    }
  }

  await backdateMedusaOrders(orderIdsToBackdate);
  return { orders, drafts, cancelled, completed };
}

async function ensureTenantCustomerGroup(tenantId: string, handle: string) {
  const listed = await medusaGet<{
    customer_groups?: Array<{ id: string; metadata?: { tenant_id?: string } | null }>;
  }>("/admin/customer-groups?limit=100");

  const existing = (listed?.customer_groups ?? []).find(
    (group) => group.metadata?.tenant_id === tenantId,
  );
  if (existing?.id) return existing.id;

  const created = await medusaPost<{ customer_group?: { id: string } }>("/admin/customer-groups", {
    metadata: { demo_seed: DEMO_SEED_MARKER, tenant_id: tenantId },
    name: `Shop ${handle}`,
  });
  return created?.customer_group?.id ?? null;
}

async function ensureDemoCustomer(
  customer: DemoShopDefinition["customers"][number],
  metadata: Record<string, string>,
  customerGroupId: string | null,
) {
  let customerId: string | null = null;

  const created = await medusaPost<{ customer?: { id: string } }>("/admin/customers", {
    email: customer.email,
    first_name: customer.firstName,
    last_name: customer.lastName,
    phone: customer.phone,
    metadata: { ...metadata, demo_customer: true },
  });

  if (created?.customer?.id) {
    customerId = created.customer.id;
  } else {
    // Email may already exist globally — look it up and reuse.
    const search = new URLSearchParams({ email: customer.email, limit: "1" });
    const found = await medusaGet<{ customers?: Array<{ id: string }> }>(
      `/admin/customers?${search}`,
    );
    customerId = found?.customers?.[0]?.id ?? null;
  }

  if (!customerId) return null;

  await medusaPost(`/admin/customers/${encodeURIComponent(customerId)}/addresses`, {
    address_1: customer.address,
    city: customer.area,
    country_code: "et",
    first_name: customer.firstName,
    is_default_shipping: true,
    last_name: customer.lastName,
    phone: customer.phone,
    province: "Addis Ababa",
  });

  if (customerGroupId) {
    await medusaPost(`/admin/customer-groups/${encodeURIComponent(customerGroupId)}/customers`, {
      add: [customerId],
    });
  }

  return customerId;
}

async function seedPromotions(
  tenantId: string,
  handle: string,
  products: ProductSeedResult[],
) {
  const now = new Date();
  const startsAt = addDays(now, -21).toISOString();
  const endsAt = addDays(now, 60).toISOString();
  const campaignPrefix = `ecs_${tenantId}_`;
  const slug = handle.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "SHOP";
  const productIds = products.slice(0, 4).map((product) => product.id).filter(Boolean);

  type PromoSeed = {
    allocation?: "across" | "each";
    campaignName: string;
    code: string;
    isAutomatic: boolean;
    method: "fixed" | "percentage";
    productIds?: string[];
    targetType: "items" | "order" | "shipping_methods";
    type: "standard";
    value: number;
  };

  const promos: PromoSeed[] = [
    {
      code: `${slug}WELCOME10`,
      campaignName: "Welcome 10% off",
      type: "standard",
      method: "percentage",
      targetType: "order",
      value: 10,
      isAutomatic: false,
    },
    {
      code: `${slug}SAVE100`,
      campaignName: "Save 100 ETB",
      type: "standard",
      method: "fixed",
      targetType: "order",
      value: 100,
      isAutomatic: false,
    },
    {
      code: `${slug}FREESHIP`,
      campaignName: "Free local delivery",
      type: "standard",
      method: "percentage",
      targetType: "shipping_methods",
      value: 100,
      isAutomatic: true,
      allocation: "across",
    },
  ];

  if (productIds.length) {
    promos.push({
      code: `${slug}PICK15`,
      campaignName: "15% off featured picks",
      type: "standard",
      method: "percentage",
      targetType: "items",
      value: 15,
      isAutomatic: false,
      productIds,
      allocation: "each",
    });
  }

  let created = 0;
  for (const promo of promos) {
    const campaignIdentifier = `${campaignPrefix}${promo.code.replace(/[^A-Z0-9]+/g, "_")}`;
    const application_method: Record<string, unknown> = {
      target_type: promo.targetType,
      type: promo.method,
      value: promo.value,
    };
    if (promo.method === "fixed") {
      application_method.currency_code = "etb";
    }
    if (promo.allocation) {
      application_method.allocation = promo.allocation;
    }
    if (promo.productIds?.length) {
      application_method.target_rules = [
        {
          attribute: "items.product.id",
          operator: "in",
          values: promo.productIds,
        },
      ];
    }

    // Medusa rejects unknown fields like metadata on promotions.
    const result = await medusaPost<{ promotion?: { id: string } }>("/admin/promotions", {
      application_method,
      campaign: {
        campaign_identifier: campaignIdentifier,
        ends_at: endsAt,
        name: promo.campaignName,
        starts_at: startsAt,
      },
      code: promo.code,
      is_automatic: promo.isAutomatic,
      is_tax_inclusive: false,
      status: "active",
      type: promo.type,
    });
    if (result?.promotion?.id) created += 1;
  }

  return created;
}

async function seedProductStock(
  productId: string,
  resources: CommerceResources,
  product: DemoProduct,
) {
  const detail = await medusaGet<{
    product?: {
      variants?: Array<{
        id?: string;
        sku?: string | null;
        title?: string | null;
        inventory_items?: Array<{ inventory_item_id?: string }>;
      }>;
    };
  }>(
    `/admin/products/${encodeURIComponent(productId)}?fields=id,variants.id,variants.sku,variants.title,variants.inventory_items.inventory_item_id`,
  );

  let stocked = 0;
  const medusaVariants = detail?.product?.variants ?? [];
  for (const [index, variant] of medusaVariants.entries()) {
    const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id;
    if (!inventoryItemId) continue;

    const definition =
      product.variants.find((item) => {
        const skuTail = item.sku;
        return Boolean(variant.sku?.endsWith(skuTail) || variant.sku?.includes(skuTail));
      }) ?? product.variants[index];
    const stockedQuantity =
      definition?.stock ?? (25 + (index % 5) * 5);

    await medusaPost(
      `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`,
      {
        location_id: resources.stockLocationId,
        stocked_quantity: stockedQuantity,
      },
    ).catch(() => null);

    // If level already exists, try update.
    await medusaPost(
      `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels/${encodeURIComponent(resources.stockLocationId)}`,
      { stocked_quantity: stockedQuantity },
    ).catch(() => null);
    stocked += 1;
  }
  return stocked;
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

function logMediaSeedConfig() {
  const config = getMediaS3Config();
  if (!config) {
    console.warn(
      "[seed:demo] MEDIA_S3_BUCKET / ACCESS_KEY / SECRET not set — product images will use remote fallback URLs only.",
    );
    return;
  }
  console.info(
    `[seed:demo] Media S3: bucket=${config.bucket} apiEndpoint=${config.endpoint ?? "(default AWS)"} publicBase=${config.publicBaseUrl ?? "(none)"} pathStyle=${config.forcePathStyle}`,
  );
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

/**
 * Server-side seed uploads should hit object storage on the Docker network
 * (http://seaweedfs:8333), not the public MEDIA_S3_ENDPOINT (https://media.…),
 * which often fails TLS/signature via Caddy for PutObject from platform-api.
 */
function resolveMediaS3ApiEndpoint(): string | undefined {
  const internal = process.env.MEDIA_S3_INTERNAL_ENDPOINT?.trim();
  if (internal) return internal.replace(/\/$/, "");

  // Dokploy / compose service DNS when running inside the stack.
  if (process.env.MEDIA_S3_USE_DOCKER_INTERNAL === "true") {
    return "http://seaweedfs:8333";
  }

  // Heuristic: public media host in prod compose — prefer in-network Seaweed.
  const publicEndpoint = process.env.MEDIA_S3_ENDPOINT?.trim();
  if (
    publicEndpoint &&
    (publicEndpoint.includes("media.") || publicEndpoint.startsWith("https://")) &&
    (process.env.HOSTNAME === "platform-api" ||
      process.env.SERVICE_NAME === "platform-api" ||
      Boolean(process.env.PLATFORM_DATABASE_URL?.includes("@postgres")))
  ) {
    return "http://seaweedfs:8333";
  }

  return publicEndpoint?.replace(/\/$/, "") || undefined;
}

function getMediaS3Config() {
  const bucket = process.env.MEDIA_S3_BUCKET?.trim();
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  // Path-style is required for SeaweedFS; default true when endpoint is set.
  const forcePathStyleEnv = process.env.MEDIA_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  const forcePathStyle =
    forcePathStyleEnv === "true" ||
    forcePathStyleEnv === "1" ||
    (forcePathStyleEnv !== "false" && Boolean(resolveMediaS3ApiEndpoint()));

  return {
    accessKeyId,
    bucket,
    endpoint: resolveMediaS3ApiEndpoint(),
    forcePathStyle,
    publicBaseUrl: process.env.MEDIA_S3_PUBLIC_BASE_URL?.trim() || undefined,
    region: process.env.MEDIA_S3_REGION?.trim() || "us-east-1",
    secretAccessKey,
  };
}

function createSeedS3Client(config: NonNullable<ReturnType<typeof getMediaS3Config>>) {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    region: config.region,
    // Seaweed / path-style often rejects checksum headers added by newer SDK defaults.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function formatS3Error(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const err = error as {
    message?: string;
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const parts = [
    err.name,
    err.Code,
    err.$metadata?.httpStatusCode != null ? `http=${err.$metadata.httpStatusCode}` : null,
    err.message,
  ].filter(Boolean);
  return parts.join(" ") || String(error);
}

async function resetTenantDemoMedia(tenantId: string) {
  await platformDb.db.delete(mediaUsages).where(eq(mediaUsages.tenantId, tenantId));
  await platformDb.db.delete(mediaAssets).where(eq(mediaAssets.tenantId, tenantId));
}

async function fetchDemoImageBytes(seed: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const url = demoImageUrl(seed.replace(/^ecs-/, "").split("-")[0] ?? seed, 0);
  // Prefer a unique picsum seed derived from the full key.
  const picsum = `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/900`;
  try {
    const response = await fetch(picsum, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > 0) {
        const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        return { bytes, mimeType };
      }
    }
  } catch {
    // fall through
  }
  void url;
  return { bytes: FALLBACK_PNG, mimeType: "image/png" };
}

type SeededMediaAsset = {
  id: string;
  publicUrl: string | null;
};

async function seedProductMediaAssets(input: {
  imageCategory: string;
  imageCount: number;
  productHandle: string;
  productTitle: string;
  tenantId: string;
  userId: string;
}): Promise<SeededMediaAsset[]> {
  const config = getMediaS3Config();
  if (!config) {
    console.warn("[seed:demo] MEDIA_S3_* not configured — product images will use remote URLs only.");
    return [];
  }

  const client = createSeedS3Client(config);
  const assets: SeededMediaAsset[] = [];

  for (let index = 0; index < input.imageCount; index += 1) {
    const seed = `ecs-${input.productHandle}-${index}`;
    const { bytes, mimeType } = await fetchDemoImageBytes(seed);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const filename = `${input.productHandle}-${index + 1}.${ext}`;
    const assetId = crypto.randomUUID();
    const objectKey = `tenants/${input.tenantId}/product/${assetId}/${filename}`;
    const publicUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/$/, "")}/${objectKey}`
      : null;

    try {
      await client.send(
        new PutObjectCommand({
          Body: bytes,
          Bucket: config.bucket,
          ContentLength: bytes.byteLength,
          ContentType: mimeType,
          Key: objectKey,
        }),
      );
    } catch (error) {
      console.warn(
        `[seed:demo] Media upload failed for ${filename} → ${config.endpoint ?? "default"}/${config.bucket}/${objectKey}: ${formatS3Error(error)}`,
      );
      if (index === 0) {
        console.warn(
          "[seed:demo] Hint: in Docker/Dokploy set MEDIA_S3_INTERNAL_ENDPOINT=http://seaweedfs:8333 " +
            "(server PutObject). Keep MEDIA_S3_PUBLIC_BASE_URL for browser URLs.",
        );
      }
      continue;
    }

    await platformDb.db.insert(mediaAssets).values({
      accessMode: "public",
      altText: `${input.productTitle} photo ${index + 1}`,
      bucket: config.bucket,
      byteSize: bytes.byteLength,
      createdByUserId: input.userId,
      displayName: filename,
      filename,
      height: 900,
      id: assetId,
      mimeType,
      objectKey,
      publicUrl,
      status: "ready",
      storageProvider: "s3",
      tenantId: input.tenantId,
      width: 900,
    });

    assets.push({ id: assetId, publicUrl });
  }

  return assets;
}

async function linkMediaUsages(input: {
  assets: SeededMediaAsset[];
  productId: string;
  tenantId: string;
  thumbnailUrl: string;
}) {
  const rows = input.assets
    .filter((asset) => asset.publicUrl)
    .map((asset, position) => ({
      field: "images",
      isPrimary: asset.publicUrl === input.thumbnailUrl || position === 0,
      mediaAssetId: asset.id,
      position,
      resourceId: input.productId,
      resourceType: "product" as const,
      tenantId: input.tenantId,
    }));
  if (!rows.length) return;
  await platformDb.db.insert(mediaUsages).values(rows);
}

async function seedPlatformExtras(
  shop: DemoShopDefinition,
  tenantId: string,
  userId: string,
  commerce: Record<string, unknown>,
) {
  await platformDb.db
    .insert(deliverySettings)
    .values({
      tenantId,
      deliveryEnabled: true,
      pickupEnabled: true,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: false,
      defaultDeliveryFee: "75",
      currency: "ETB",
      zones: [
        { name: "Bole", fee: "75.00" },
        { name: "Kazanchis", fee: "80.00" },
        { name: "CMC", fee: "90.00" },
        { name: "Megenagna", fee: "85.00" },
        { name: "Piassa", fee: "95.00" },
        { name: "Sarbet", fee: "90.00" },
        { name: "Old Airport", fee: "85.00" },
      ],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: deliverySettings.tenantId,
      set: {
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "75",
        currency: "ETB",
        zones: [
          { name: "Bole", fee: "75.00" },
          { name: "Kazanchis", fee: "80.00" },
          { name: "CMC", fee: "90.00" },
          { name: "Megenagna", fee: "85.00" },
          { name: "Piassa", fee: "95.00" },
          { name: "Sarbet", fee: "90.00" },
          { name: "Old Airport", fee: "85.00" },
        ],
        updatedAt: new Date(),
      },
    });

  // Email preference (no Telegram destinations — needs bot connect).
  const existingPrefs = await platformDb.db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.tenantId, tenantId),
        eq(notificationPreferences.channel, "email"),
      ),
    )
    .limit(1);

  if (existingPrefs[0]?.id) {
    await platformDb.db
      .update(notificationPreferences)
      .set({
        enabled: true,
        events: [...DEMO_NOTIFICATION_EVENTS],
        target: shop.user.email,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.id, existingPrefs[0].id));
  } else {
    await platformDb.db.insert(notificationPreferences).values({
      tenantId,
      channel: "email",
      enabled: true,
      target: shop.user.email,
      events: [...DEMO_NOTIFICATION_EVENTS],
    });
  }

  // Payment onboarding stub (no secret — COD-only until merchant configures Chapa).
  const existingPayment = await platformDb.db
    .select({ id: paymentOnboarding.id })
    .from(paymentOnboarding)
    .where(
      and(eq(paymentOnboarding.tenantId, tenantId), eq(paymentOnboarding.provider, "chapa")),
    )
    .limit(1);

  if (existingPayment[0]?.id) {
    await platformDb.db
      .update(paymentOnboarding)
      .set({
        notes: shop.paymentOnboarding.notes,
        status: shop.paymentOnboarding.status,
        onlineEnabled: false,
        secretKey: null,
        secretFingerprint: null,
        credentialsValidatedAt: null,
      })
      .where(eq(paymentOnboarding.id, existingPayment[0].id));
  } else {
    await platformDb.db.insert(paymentOnboarding).values({
      tenantId,
      provider: "chapa",
      status: shop.paymentOnboarding.status,
      notes: shop.paymentOnboarding.notes,
      onlineEnabled: false,
      requiredDocuments: [],
    });
  }

  // Inbox samples (tenant-wide). Replace prior demo rows via dedupe keys.
  const inboxRows = [
    {
      dedupeKey: `demo:${tenantId}:order.created`,
      eventType: "order.created",
      title: "New cash order",
      body: "A demo COD order was placed and needs confirmation.",
      href: "/admin/orders",
      readAt: null as Date | null,
    },
    {
      dedupeKey: `demo:${tenantId}:inventory.low`,
      eventType: "inventory.low",
      title: "Low stock on popular SKUs",
      body: "Some demo variants are at or near zero stock — restock from Products.",
      href: "/admin/products",
      readAt: null as Date | null,
    },
    {
      dedupeKey: `demo:${tenantId}:payment.paid`,
      eventType: "payment.paid",
      title: "Payment received",
      body: "A demo payment.paid event for the inbox UI (read).",
      href: "/admin/orders",
      readAt: addDays(new Date(), -1),
    },
    {
      dedupeKey: `demo:${tenantId}:order.cancelled`,
      eventType: "order.cancelled",
      title: "Order cancelled",
      body: "A customer cancelled a demo order.",
      href: "/admin/orders",
      readAt: addDays(new Date(), -2),
    },
  ];

  for (const row of inboxRows) {
    await platformDb.db
      .insert(inAppNotifications)
      .values({
        body: row.body,
        dedupeKey: row.dedupeKey,
        eventType: row.eventType,
        href: row.href,
        payload: {
          demo_seed: DEMO_SEED_MARKER,
          shop_handle: shop.tenant.handle,
        },
        readAt: row.readAt,
        tenantId,
        title: row.title,
        userId: null,
      })
      .onConflictDoUpdate({
        target: [inAppNotifications.tenantId, inAppNotifications.dedupeKey],
        set: {
          body: row.body,
          eventType: row.eventType,
          href: row.href,
          readAt: row.readAt,
          title: row.title,
        },
      });
  }

  void userId;
  void commerce;

  return {
    deliveryZones: 7,
    notificationPrefs: 1,
    inbox: inboxRows.length,
    paymentOnboarding: shop.paymentOnboarding.status,
  };
}

function demoAddress(customer: DemoShopDefinition["customers"][number]) {
  return {
    address_1: customer.address,
    city: customer.area,
    country_code: "et",
    first_name: customer.firstName,
    last_name: customer.lastName,
    phone: customer.phone,
    province: "Addis Ababa",
  };
}

async function seedMetrics(tenantId: string) {
  // Replace prior demo metrics so re-seeds refresh the chart series.
  await platformDb.db.delete(dailyMetrics).where(eq(dailyMetrics.tenantId, tenantId));

  const now = new Date();
  const rows: Array<typeof dailyMetrics.$inferInsert> = [];
  const days = 45;

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = addDays(now, -index).toISOString().slice(0, 10);
    const day = days - 1 - index;
    // Growth curve with weekday/weekend rhythm and a mid-month campaign bump.
    const weekday = addDays(now, -index).getUTCDay();
    const weekendLift = weekday === 0 || weekday === 6 ? 0.72 : 1;
    const campaignLift = day >= 22 && day <= 30 ? 1.35 : 1;
    const trend = 4 + day * 0.28;
    const wave = Math.sin(day / 3.1) * 2.4 + Math.cos(day / 7.4) * 1.6;
    const orders = Math.max(1, Math.round((trend + wave) * weekendLift * campaignLift));
    const aov = 1650 + (day % 6) * 180 + (campaignLift > 1 ? 320 : 0);
    const customers = Math.max(1, Math.round(orders * (0.55 + (day % 5) * 0.04)));

    rows.push(
      metricRow(tenantId, date, "overview.revenue", orders * aov),
      metricRow(tenantId, date, "overview.orders", orders),
      metricRow(tenantId, date, "overview.customers", customers),
    );
  }

  const latest = addDays(now, 0).toISOString().slice(0, 10);
  rows.push(
    metricRow(tenantId, latest, "overview.products", 12),
    metricRow(tenantId, latest, "overview.attention.unfulfilled", 4),
    metricRow(tenantId, latest, "overview.attention.unpaid", 3),
    metricRow(tenantId, latest, "overview.attention.draft_products", 1),
    metricRow(tenantId, latest, "overview.order_status", 18, "status", "completed"),
    metricRow(tenantId, latest, "overview.order_status", 5, "status", "pending"),
    metricRow(tenantId, latest, "overview.order_status", 2, "status", "canceled"),
    metricRow(tenantId, latest, "overview.payment_status", 16, "status", "captured"),
    metricRow(tenantId, latest, "overview.payment_status", 6, "status", "not_paid"),
    metricRow(tenantId, latest, "overview.payment_status", 3, "status", "awaiting"),
    metricRow(tenantId, latest, "overview.fulfillment_status", 12, "status", "fulfilled"),
    metricRow(tenantId, latest, "overview.fulfillment_status", 7, "status", "not_fulfilled"),
    metricRow(tenantId, latest, "overview.fulfillment_status", 4, "status", "partially_fulfilled"),
  );

  if (rows.length) {
    await platformDb.db.insert(dailyMetrics).values(rows);
  }
}

async function seedAnalyticsEvents(tenantId: string, handle: string) {
  await platformDb.db
    .delete(analyticsEvents)
    .where(eq(analyticsEvents.tenantId, tenantId));

  const now = new Date();
  const types = [
    "storefront.page_view",
    "storefront.product_viewed",
    "storefront.collection_viewed",
    "storefront.cart_created",
    "storefront.checkout_started",
  ] as const;

  // Spread events across ~40 days with denser recent activity.
  const events = Array.from({ length: 90 }, (_, index) => {
    const eventType = types[index % types.length]!;
    const daysAgo = Math.min(39, Math.floor((index * 0.45) % 40));
    const occurredAt = addDays(now, -daysAgo);
    occurredAt.setUTCHours(9 + (index % 10), (index * 7) % 60, index % 60, 0);
    return {
      eventType,
      idempotencyKey: `demo:${handle}:${eventType}:${index}`,
      occurredAt,
      properties: { demo_seed: DEMO_SEED_MARKER, handle },
      source: "storefront" as const,
      subjectId: null,
      subjectType: null,
      tenantId,
    };
  });

  await platformDb.db.insert(analyticsEvents).values(events);
}

function metricRow(
  tenantId: string,
  date: string,
  metricKey: string,
  value: number,
  dimensionKey?: string,
  dimensionValue?: string,
) {
  return {
    date,
    ...(dimensionKey ? { dimensionKey } : {}),
    ...(dimensionValue ? { dimensionValue } : {}),
    metricKey,
    tenantId,
    value: String(value),
  } satisfies typeof dailyMetrics.$inferInsert;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function cleanAllDemoData() {
  const handles = [
    ...demoShops.map((shop) => shop.tenant.handle),
    ...LEGACY_DEMO_HANDLES,
  ];
  const emails = [
    ...demoShops.map((shop) => shop.user.email),
    ...LEGACY_DEMO_EMAILS,
  ];
  const tenantIds = demoShops.map((shop) => shop.ids.tenant);

  const existingTenants = await platformDb.db
    .select({
      id: tenants.id,
      handle: tenants.handle,
      medusaSalesChannelId: tenants.medusaSalesChannelId,
    })
    .from(tenants)
    .where(inArray(tenants.handle, handles));

  const idsToRemove = [
    ...new Set([...tenantIds, ...existingTenants.map((row) => row.id)]),
  ];

  let commerce = { categories: 0, collections: 0, customers: 0, orders: 0, products: 0, promotions: 0 };

  for (const shop of demoShops) {
    const live =
      existingTenants.find((row) => row.handle === shop.tenant.handle) ??
      existingTenants.find((row) => row.id === shop.ids.tenant);
    const tenantId = live?.id ?? shop.ids.tenant;
    const channelId = live?.medusaSalesChannelId ?? null;
    // Also pass legacy handles so catalog rows tagged with old shop_handle are removed.
    const removed = await cleanShopCommerce(shop.tenant.handle, tenantId, channelId);
    commerce = {
      categories: commerce.categories + removed.categories,
      collections: commerce.collections + removed.collections,
      customers: commerce.customers + removed.customers,
      orders: commerce.orders + removed.orders,
      products: commerce.products + removed.products,
      promotions: commerce.promotions + removed.promotions,
    };
  }

  // Legacy handle commerce (e.g. addis-tech) when stable tenant row already gone.
  for (const legacyHandle of LEGACY_DEMO_HANDLES) {
    if (demoShops.some((shop) => shop.tenant.handle === legacyHandle)) continue;
    const live = existingTenants.find((row) => row.handle === legacyHandle);
    if (!live) continue;
    const removed = await cleanShopCommerce(legacyHandle, live.id, live.medusaSalesChannelId);
    commerce = {
      categories: commerce.categories + removed.categories,
      collections: commerce.collections + removed.collections,
      customers: commerce.customers + removed.customers,
      orders: commerce.orders + removed.orders,
      products: commerce.products + removed.products,
      promotions: commerce.promotions + removed.promotions,
    };
  }

  if (idsToRemove.length) {
    // Delete every platform table that FKs tenants (ON DELETE NO ACTION).
    // Order: dependents with nested FKs first (media usages → assets), then tenants.
    await platformDb.db
      .delete(analyticsEvents)
      .where(inArray(analyticsEvents.tenantId, idsToRemove));
    await platformDb.db.delete(dailyMetrics).where(inArray(dailyMetrics.tenantId, idsToRemove));
    await platformDb.db
      .delete(storefrontConfigs)
      .where(inArray(storefrontConfigs.tenantId, idsToRemove));
    await platformDb.db
      .delete(storefrontRevisions)
      .where(inArray(storefrontRevisions.tenantId, idsToRemove));
    await platformDb.db
      .delete(tenantOnboarding)
      .where(inArray(tenantOnboarding.tenantId, idsToRemove));
    await platformDb.db
      .delete(tenantMemberships)
      .where(inArray(tenantMemberships.tenantId, idsToRemove));
    await platformDb.db.delete(domains).where(inArray(domains.tenantId, idsToRemove));
    await platformDb.db.delete(invoices).where(inArray(invoices.tenantId, idsToRemove));
    await platformDb.db
      .delete(subscriptions)
      .where(inArray(subscriptions.tenantId, idsToRemove));
    await platformDb.db
      .delete(tenantProvisioningAttempts)
      .where(inArray(tenantProvisioningAttempts.tenantId, idsToRemove));
    await platformDb.db
      .delete(tenantProvisioningAttempts)
      .where(inArray(tenantProvisioningAttempts.platformTenantId, idsToRemove));
    await platformDb.db
      .delete(deliverySettings)
      .where(inArray(deliverySettings.tenantId, idsToRemove));
    await platformDb.db
      .delete(paymentOnboarding)
      .where(inArray(paymentOnboarding.tenantId, idsToRemove));
    await platformDb.db
      .delete(notificationPreferences)
      .where(inArray(notificationPreferences.tenantId, idsToRemove));
    await platformDb.db
      .delete(notificationLogs)
      .where(inArray(notificationLogs.tenantId, idsToRemove));
    await platformDb.db
      .delete(notificationDestinations)
      .where(inArray(notificationDestinations.tenantId, idsToRemove));
    await platformDb.db
      .delete(telegramConnectSessions)
      .where(inArray(telegramConnectSessions.tenantId, idsToRemove));
    await platformDb.db
      .delete(inAppNotifications)
      .where(inArray(inAppNotifications.tenantId, idsToRemove));
    await platformDb.db
      .delete(operatorNotes)
      .where(inArray(operatorNotes.tenantId, idsToRemove));
    await platformDb.db.delete(mediaUsages).where(inArray(mediaUsages.tenantId, idsToRemove));
    await platformDb.db.delete(mediaAssets).where(inArray(mediaAssets.tenantId, idsToRemove));
    await platformDb.db.delete(tenants).where(inArray(tenants.id, idsToRemove));
  }

  const existingUsers = await platformDb.db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));
  const userIds = existingUsers.map((row) => row.id);
  if (userIds.length) {
    await platformDb.db.delete(accounts).where(inArray(accounts.userId, userIds));
    await platformDb.db.delete(users).where(inArray(users.id, userIds));
  }

  void DEFAULT_PLAN_IDS;

  return {
    commerce,
    tenantsRemoved: idsToRemove.length,
    usersRemoved: userIds.length,
  };
}

function isDemoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  tenantId: string,
  handle: string,
) {
  if (!metadata) return false;
  // Always scope to this tenant/handle so multi-shop re-seeds do not cross-delete.
  if (metadata.platform_tenant_id === tenantId) return true;
  if (metadata.shop_handle === handle) return true;
  // Renamed tech shop: old handle still tags catalog on the same stable tenant id path above;
  // when cleaning by legacy handle, match products tagged with that handle.
  if (
    (LEGACY_DEMO_HANDLES as readonly string[]).includes(handle) &&
    metadata.shop_handle === handle
  ) {
    return true;
  }
  if (
    handle === "addistech" &&
    metadata.shop_handle === "addis-tech" &&
    (metadata.platform_tenant_id === tenantId ||
      metadata.demo_seed === DEMO_SEED_MARKER ||
      metadata.demo_seed === "ecs-demo-v2")
  ) {
    return true;
  }
  return false;
}

async function cleanShopCommerce(
  handle: string,
  tenantId: string,
  salesChannelId?: string | null,
) {
  const summary = {
    categories: 0,
    collections: 0,
    customers: 0,
    orders: 0,
    products: 0,
    promotions: 0,
  };

  if (!medusaAdminApiToken) return summary;

  const demoEmails = new Set(demoShops.flatMap((shop) => shop.customers.map((c) => c.email)));

  // Orders first so product deletes are less likely to fail on line-item refs.
  // Cancel + archive removes them from the default merchant list on re-seed.
  summary.orders = await cleanDemoOrders({
    demoEmails,
    handle,
    tenantId,
    ...(salesChannelId !== undefined ? { salesChannelId } : {}),
  });
  await cleanDemoDraftOrders({
    demoEmails,
    handle,
    tenantId,
    ...(salesChannelId !== undefined ? { salesChannelId } : {}),
  });

  const shop = demoShops.find((item) => item.tenant.handle === handle);
  const shopProductHandles = new Set(shop?.products.map((item) => item.handle) ?? []);

  // Paginate products — a single page misses leftovers after prior partial seeds.
  for await (const product of paginateMedusaList<{
    handle?: string | null;
    id: string;
    metadata?: Record<string, unknown>;
  }>("/admin/products", "products", "id,handle,metadata")) {
    const byMeta = isDemoMetadata(product.metadata, tenantId, handle);
    const byHandle = Boolean(product.handle && shopProductHandles.has(product.handle));
    if (byMeta || byHandle) {
      await medusaDelete(`/admin/products/${encodeURIComponent(product.id)}`);
      summary.products += 1;
    }
  }

  const shopCollectionHandles = new Set(shop?.collections.map((item) => item.handle) ?? []);
  for await (const collection of paginateMedusaList<{
    handle?: string | null;
    id: string;
    metadata?: Record<string, unknown>;
  }>("/admin/collections", "collections", "id,handle,metadata")) {
    if (
      isDemoMetadata(collection.metadata, tenantId, handle) ||
      (collection.handle && shopCollectionHandles.has(collection.handle))
    ) {
      await medusaDelete(`/admin/collections/${encodeURIComponent(collection.id)}`);
      summary.collections += 1;
    }
  }

  const shopCategoryHandles = new Set(shop?.categories.map((item) => item.handle) ?? []);
  // Collect matching categories, then delete children before parents (Medusa FK).
  const categoriesToDelete: Array<{ id: string; handle?: string | null }> = [];
  for await (const category of paginateMedusaList<{
    handle?: string | null;
    id: string;
    metadata?: Record<string, unknown>;
  }>("/admin/product-categories", "product_categories", "id,handle,metadata")) {
    if (
      isDemoMetadata(category.metadata, tenantId, handle) ||
      (category.handle && shopCategoryHandles.has(category.handle))
    ) {
      categoriesToDelete.push(category);
    }
  }
  const parentHandles = new Set(
    (shop?.categories ?? []).filter((item) => !item.parentHandle).map((item) => item.handle),
  );
  categoriesToDelete.sort((a, b) => {
    const aParent = a.handle && parentHandles.has(a.handle) ? 1 : 0;
    const bParent = b.handle && parentHandles.has(b.handle) ? 1 : 0;
    return aParent - bParent;
  });
  for (const category of categoriesToDelete) {
    await medusaDelete(`/admin/product-categories/${encodeURIComponent(category.id)}`);
    summary.categories += 1;
  }

  // Demo customers (by known emails).
  for (const customer of shop?.customers ?? []) {
    const found = await medusaGet<{
      customers?: Array<{ id: string }>;
    }>(`/admin/customers?limit=5&email=${encodeURIComponent(customer.email)}`);
    for (const row of found?.customers ?? []) {
      await medusaDelete(`/admin/customers/${encodeURIComponent(row.id)}`);
      summary.customers += 1;
    }
  }

  summary.promotions = await cleanTenantPromotions(tenantId, handle);
  return summary;
}

/**
 * Remove demo orders from the merchant list on re-seed.
 * Medusa has no hard delete for orders — cancel + archive is the supported cleanup.
 */
async function cleanDemoOrders(input: {
  demoEmails: Set<string>;
  handle: string;
  salesChannelId?: string | null;
  tenantId: string;
}) {
  let removed = 0;
  const pageSize = 100;
  let offset = 0;

  for (let page = 0; page < 20; page += 1) {
    const orderQuery = new URLSearchParams({
      fields: "id,metadata,sales_channel_id,email,status",
      limit: String(pageSize),
      offset: String(offset),
      order: "-created_at",
    });
    // Medusa list expects array form for sales channel filter.
    if (input.salesChannelId) {
      orderQuery.append("sales_channel_id[]", input.salesChannelId);
    }

    const listed = await medusaGet<{
      count?: number;
      orders?: Array<{
        email?: string | null;
        id: string;
        metadata?: Record<string, unknown> | null;
        sales_channel_id?: string | null;
        status?: string | null;
      }>;
    }>(`/admin/orders?${orderQuery}`);

    const batch = listed?.orders ?? [];
    if (batch.length === 0) break;

    for (const order of batch) {
      const channelMatch =
        !input.salesChannelId || order.sales_channel_id === input.salesChannelId;
      const demoOrder =
        isDemoMetadata(order.metadata ?? undefined, input.tenantId, input.handle) ||
        (channelMatch && order.email && input.demoEmails.has(order.email));
      if (!demoOrder || !channelMatch) continue;

      const status = (order.status ?? "").toLowerCase();
      if (!status.includes("cancel")) {
        await medusaPost(`/admin/orders/${encodeURIComponent(order.id)}/cancel`, {}).catch(
          () => null,
        );
      }
      await medusaPost(`/admin/orders/${encodeURIComponent(order.id)}/archive`, {}).catch(
        () => null,
      );
      removed += 1;
    }

    offset += batch.length;
    if (batch.length < pageSize) break;
    if (typeof listed?.count === "number" && offset >= listed.count) break;
  }

  return removed;
}

async function cleanDemoDraftOrders(input: {
  demoEmails: Set<string>;
  handle: string;
  salesChannelId?: string | null;
  tenantId: string;
}) {
  for await (const draft of paginateMedusaList<{
    email?: string | null;
    id: string;
    metadata?: Record<string, unknown> | null;
    sales_channel_id?: string | null;
  }>("/admin/draft-orders", "draft_orders", "id,metadata,sales_channel_id,email")) {
    const channelMatch =
      !input.salesChannelId || draft.sales_channel_id === input.salesChannelId;
    const isDemo =
      isDemoMetadata(draft.metadata ?? undefined, input.tenantId, input.handle) ||
      (channelMatch && draft.email && input.demoEmails.has(draft.email));
    if (!isDemo || !channelMatch) continue;
    await medusaDelete(`/admin/draft-orders/${encodeURIComponent(draft.id)}`);
  }
}

/** Walk Medusa admin list endpoints until exhausted (or a safety page cap). */
async function* paginateMedusaList<T extends { id: string }>(
  path: string,
  key: string,
  fields: string,
  pageSize = 100,
): AsyncGenerator<T> {
  let offset = 0;
  for (let page = 0; page < 30; page += 1) {
    const query = new URLSearchParams({
      fields,
      limit: String(pageSize),
      offset: String(offset),
    });
    const separator = path.includes("?") ? "&" : "?";
    const listed = await medusaGet<Record<string, unknown>>(
      `${path}${separator}${query.toString()}`,
    );
    const batch = Array.isArray(listed?.[key]) ? (listed[key] as T[]) : [];
    if (batch.length === 0) return;
    for (const item of batch) {
      yield item;
    }
    offset += batch.length;
    if (batch.length < pageSize) return;
  }
}

async function cleanTenantPromotions(tenantId: string, handle: string) {
  let removed = 0;
  const campaignPrefix = `ecs_${tenantId}_`;
  const slug = handle.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "SHOP";
  const promotions = await medusaGet<{
    promotions?: Array<{
      id: string;
      code?: string | null;
      campaign?: { campaign_identifier?: string | null } | null;
      campaign_id?: string | null;
    }>;
  }>("/admin/promotions?limit=100&fields=id,code,+campaign,+campaign.campaign_identifier");

  for (const promotion of promotions?.promotions ?? []) {
    const identifier = promotion.campaign?.campaign_identifier ?? "";
    const code = (promotion.code ?? "").toUpperCase();
    const isDemo =
      identifier.startsWith(campaignPrefix) ||
      code.startsWith(slug) ||
      code.startsWith(handle.slice(0, 4).toUpperCase());
    if (isDemo) {
      await medusaDelete(`/admin/promotions/${encodeURIComponent(promotion.id)}`);
      removed += 1;
    }
  }

  // Deleting a promotion can leave the campaign row; identifiers must be free for re-seed.
  const campaigns = await medusaGet<{
    campaigns?: Array<{ campaign_identifier?: string | null; id: string }>;
  }>("/admin/campaigns?limit=100");

  for (const campaign of campaigns?.campaigns ?? []) {
    const identifier = campaign.campaign_identifier ?? "";
    if (identifier.startsWith(campaignPrefix) || identifier.includes(tenantId)) {
      await medusaDelete(`/admin/campaigns/${encodeURIComponent(campaign.id)}`);
    }
  }

  return removed;
}

/**
 * Backdate converted orders so the list/overview feel multi-day.
 * Admin API cannot set created_at — update Medusa DB directly when available.
 */
async function backdateMedusaOrders(entries: Array<{ id: string; createdAt: Date }>) {
  if (!entries.length) return;
  const client = await getMedusaPgClient();
  if (!client) return;
  try {
    for (const entry of entries) {
      await client.query(
        `UPDATE "order" SET created_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL`,
        [entry.createdAt.toISOString(), entry.id],
      );
    }
  } finally {
    await client.end();
  }
}

async function backdateMedusaDraftOrder(draftId: string, createdAt: Date) {
  // Draft-order plugin stores drafts as order rows with is_draft_order = true.
  await backdateMedusaOrders([{ id: draftId, createdAt }]);
}

/**
 * Resolve Medusa Postgres URL for order backdating.
 * Prefer MEDUSA_DATABASE_URL (set on platform-api in Dokploy). Fallbacks:
 * - MEDUSA_DB_URL
 * - DATABASE_URL when it targets medusa
 * - apps/medusa/.env (local monorepo)
 * - Derive from PLATFORM_DATABASE_URL by swapping platform_db → medusa_db
 * - Local default last (localhost) — wrong inside Docker; env must be set there
 */
function resolveMedusaDatabaseUrl() {
  const candidates = [
    process.env.MEDUSA_DATABASE_URL,
    process.env.MEDUSA_DB_URL,
    process.env.DATABASE_URL?.includes("medusa") ? process.env.DATABASE_URL : undefined,
    deriveMedusaUrlFromPlatformDatabaseUrl(process.env.PLATFORM_DATABASE_URL),
  ];

  try {
    const medusaEnvPath = resolve(getPlatformApiServiceDir(import.meta.url), "../medusa/.env");
    if (existsSync(medusaEnvPath)) {
      const text = readFileSync(medusaEnvPath, "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
        if (match?.[1]) {
          candidates.push(match[1].trim().replace(/^["']|["']$/g, ""));
          break;
        }
      }
    }
  } catch {
    // ignore
  }

  candidates.push("postgres://ecs:ecs@localhost:5432/medusa_db");

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    let url = raw.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      url = url.replace(/^https?:\/\//, "postgres://");
    }
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return url;
    }
  }

  return "postgres://ecs:ecs@localhost:5432/medusa_db";
}

/** Same Postgres server, sibling database name — common docker-compose layout. */
function deriveMedusaUrlFromPlatformDatabaseUrl(platformUrl: string | undefined) {
  if (!platformUrl?.trim()) return undefined;
  const raw = platformUrl.trim();
  if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) return undefined;

  // .../platform_db or .../platform → .../medusa_db
  if (/\/platform_db(?:\?|$)/.test(raw)) {
    return raw.replace(/\/platform_db(?=\?|$)/, "/medusa_db");
  }
  if (/\/platform(?:\?|$)/.test(raw)) {
    return raw.replace(/\/platform(?=\?|$)/, "/medusa_db");
  }
  return undefined;
}

async function loadPgModule() {
  // Prefer direct dependency (listed on platform-api for deploy images).
  try {
    return await import("pg");
  } catch {
    // Fallbacks for monorepo layouts where pg is only under @ecs/db.
  }

  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const candidates = [
    resolve(getPlatformApiServiceDir(import.meta.url), "package.json"),
    resolve(getPlatformApiServiceDir(import.meta.url), "node_modules/@ecs/db/package.json"),
    resolve(getPlatformApiServiceDir(import.meta.url), "../../packages/db/package.json"),
  ];

  for (const packageJson of candidates) {
    try {
      const require = createRequire(packageJson);
      const pgPath = require.resolve("pg");
      return await import(pathToFileURL(pgPath).href);
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    'Cannot load "pg". In Docker/Dokploy use: node --import tsx src/seeds/demo-seed.ts (from /app in platform-api). Ensure the image includes dependency "pg".',
  );
}

async function getMedusaPgClient() {
  const connectionString = resolveMedusaDatabaseUrl();
  try {
    const pg = await loadPgModule();
    const Client = pg.default?.Client ?? pg.Client;
    const client = new Client({ connectionString });
    await client.connect();
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Could not connect to Medusa DB to backdate orders (${message}). Using connection ${connectionString.replace(/:[^:@/]+@/, ":***@")}.`,
    );
    return null;
  }
}

async function medusaGet<T>(path: string): Promise<T | null> {
  return medusaRequest<T>(path, { method: "GET" });
}

async function medusaPost<T>(path: string, body: unknown): Promise<T | null> {
  return medusaRequest<T>(path, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

async function medusaDelete(path: string) {
  await medusaRequest(path, { method: "DELETE" });
}

async function medusaRequest<T = unknown>(
  path: string,
  init: RequestInit,
): Promise<T | null> {
  if (!medusaAdminApiToken) return null;

  const response = await fetch(`${medusaInternalUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      // Medusa secret API keys use Basic auth (same as platform product adapter).
      authorization: `Basic ${medusaAdminApiToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  }).catch(() => null);

  if (!response?.ok) {
    if (process.env.SEED_DEMO_DEBUG === "true") {
      const body = await response?.text().catch(() => "");
      console.warn(
        `[seed:demo] ${init.method ?? "GET"} ${path} → ${response?.status ?? "network"} ${body?.slice(0, 200) ?? ""}`,
      );
    }
    return null;
  }
  if (response.status === 204) return {} as T;
  return (await response.json().catch(() => null)) as T | null;
}

try {
  await main();
} finally {
  await platformDb.pool.end();
}
