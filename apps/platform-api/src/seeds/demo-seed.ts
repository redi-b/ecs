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
 * Prerequisites: `pnpm seed --write-env`, Medusa + platform DB running.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadServiceEnv } from "@ecs/config";
import {
  accounts,
  analyticsEvents,
  createPlatformDb,
  dailyMetrics,
  domains,
  invoices,
  storefrontConfigs,
  storefrontRevisions,
  subscriptions,
  tenantMemberships,
  tenantOnboarding,
  tenantProvisioningAttempts,
  tenants,
  users,
} from "@ecs/db";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";

import { createMedusaCommerceProvisioningClient } from "../adapters/medusa/commerce-provisioning.js";
import { getPlatformApiServiceDir, loadPlatformApiEnvFiles } from "../config/env.js";
import { DEFAULT_PLAN_IDS, createBillingService } from "../modules/billing/service.js";
import { createTenantShopProvisioningService } from "../modules/tenants/shop-provisioning.js";
import {
  DEMO_OWNER_PASSWORD,
  DEMO_SEED_MARKER,
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
const medusaAdminApiToken = process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ?? "";
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
  variants?: Array<{ id: string; title: string }>;
};

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

  if (!medusaAdminApiToken) {
    const message =
      "MEDUSA_ADMIN_API_TOKEN is not set. Run `pnpm seed --write-env` first, then re-run seed:demo.";
    if (!allowPartial) throw new Error(message);
    console.warn(`[seed:demo] ${message}`);
  }

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

  Tech shop:    http://addis-tech.${platformBaseDomain}/admin
  Owner:        owner@addis-tech.local
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
      target: users.email,
      set: {
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

  const categories: Array<{ id: string; name: string }> = [];
  for (const category of shop.categories) {
    const result = await medusaPost<{ product_category?: { id: string; name: string } }>(
      "/admin/product-categories",
      {
        handle: category.handle,
        is_active: true,
        is_internal: false,
        metadata,
        name: category.name,
      },
    );
    if (result?.product_category) categories.push(result.product_category);
  }

  const collections: Array<{ id: string; title: string }> = [];
  for (const collection of shop.collections) {
    const result = await medusaPost<{ collection?: { id: string; title: string } }>(
      "/admin/collections",
      {
        handle: collection.handle,
        metadata,
        title: collection.title,
      },
    );
    if (result?.collection) collections.push(result.collection);
  }

  const products: ProductSeedResult[] = [];
  for (const [index, product] of shop.products.entries()) {
    const category = categories[index % categories.length];
    const collection = collections[index % collections.length];
    const image = demoImageUrl(product.imageCategory);

    const result = await medusaPost<{ product?: ProductSeedResult }>("/admin/products", {
      categories: category ? [{ id: category.id }] : [],
      collection_id: collection?.id,
      description: product.description,
      handle: product.handle,
      images: [{ url: image }],
      metadata,
      options: [
        {
          title: product.optionTitle,
          values: product.variants.map((variant) => variant.option),
        },
      ],
      sales_channels: [{ id: resources.salesChannelId }],
      shipping_profile_id: resources.shippingProfileId,
      status: "published",
      thumbnail: image,
      title: product.title,
      variants: product.variants.map((variant) => ({
        manage_inventory: true,
        options: { [product.optionTitle]: variant.option },
        prices: [{ amount: variant.price, currency_code: "etb" }],
        // Prefix SKUs with tenant short id so re-seeds after soft-delete do not collide.
        sku: `${tenantId.slice(0, 8)}_${variant.sku}`.slice(0, 64),
        title: variant.title,
      })),
    });

    if (result?.product?.id) {
      // Create response may omit variants; re-fetch so orders can use variant ids.
      const detailed = await medusaGet<{ product?: ProductSeedResult }>(
        `/admin/products/${encodeURIComponent(result.product.id)}?fields=id,title,variants.id,variants.title`,
      );
      products.push(detailed?.product ?? result.product);
      await seedProductStock(result.product.id, resources, 25 + (index % 10) * 5);
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

  // Cash (COD) draft orders → convert a few to real orders, dates spread for charts/list.
  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      productTitle: product.title,
      variantId: variant.id,
    })),
  );
  let ordersCreated = 0;
  const orderCount = Math.min(10, variants.length, Math.max(shop.customers.length * 2, 4));
  const orderIdsToBackdate: Array<{ id: string; createdAt: Date }> = [];

  for (let index = 0; index < orderCount; index += 1) {
    const variant = variants[index];
    const customer = shop.customers[index % shop.customers.length];
    if (!variant || !customer) continue;

    // Spread across ~35 days: newest first index, older as index grows.
    const daysAgo = Math.min(34, Math.round((index / Math.max(orderCount - 1, 1)) * 34));
    const placedAt = addDays(new Date(), -daysAgo);
    placedAt.setUTCHours(9 + (index % 9), (index * 11) % 60, index % 60, 0);

    const draft = await medusaPost<{ draft_order?: { id: string }; order?: { id: string } }>(
      "/admin/draft-orders",
      {
        billing_address: demoAddress(customer),
        email: customer.email,
        ...(customerIds[index % customerIds.length]
          ? { customer_id: customerIds[index % customerIds.length] }
          : {}),
        items: [
          {
            quantity: (index % 3) + 1,
            variant_id: variant.variantId,
          },
        ],
        metadata: {
          ...metadata,
          created_from: "demo_seed",
          checkout_type: "cod",
          payment_method: "cod",
          // Alternate delivery vs pickup so the orders list has real delivery types.
          delivery_choice: index % 3 === 0 ? "pickup" : "delivery",
          customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
          customer_phone: customer.phone,
          note: "Demo cash order",
          demo_placed_at: placedAt.toISOString(),
        },
        region_id: resources.regionId,
        sales_channel_id: resources.salesChannelId,
        shipping_address: demoAddress(customer),
        // Do not pass shipping_methods on create — Medusa requires name/amount there
        // and rejects the whole draft. Shipping can be added later via edit endpoints.
      },
    );

    const draftId = draft?.draft_order?.id ?? draft?.order?.id;
    if (!draftId) continue;

    // Convert most orders; leave every 4th as an open draft.
    if (index % 4 !== 3) {
      const converted = await medusaPost<{ order?: { id: string } }>(
        `/admin/draft-orders/${encodeURIComponent(draftId)}/convert-to-order`,
        {},
      );
      if (converted?.order?.id) {
        orderIdsToBackdate.push({ id: converted.order.id, createdAt: placedAt });
        ordersCreated += 1;
      }
    } else {
      // Draft orders live in draft_order table — still count for seed summary.
      await backdateMedusaDraftOrder(draftId, placedAt);
      ordersCreated += 1;
    }
  }

  await backdateMedusaOrders(orderIdsToBackdate);

  return {
    skipped: false,
    categories: categories.length,
    collections: collections.length,
    products: products.length,
    customers: customersCreated,
    promotions: promotionsCreated,
    orders: ordersCreated,
    createdBy: userId,
  };
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
  stockedQuantity: number,
) {
  const detail = await medusaGet<{
    product?: {
      variants?: Array<{
        id?: string;
        inventory_items?: Array<{ inventory_item_id?: string }>;
      }>;
    };
  }>(
    `/admin/products/${encodeURIComponent(productId)}?fields=id,variants.id,variants.inventory_items.inventory_item_id`,
  );

  for (const variant of detail?.product?.variants ?? []) {
    const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id;
    if (!inventoryItemId) continue;

    await medusaPost(`/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`, {
      location_id: resources.stockLocationId,
      stocked_quantity: stockedQuantity,
    }).catch(() => null);

    // If level already exists, try update.
    await medusaPost(
      `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels/${encodeURIComponent(resources.stockLocationId)}`,
      { stocked_quantity: stockedQuantity },
    ).catch(() => null);
  }
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
  const handles = demoShops.map((shop) => shop.tenant.handle);
  const emails = demoShops.map((shop) => shop.user.email);
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
    const live = existingTenants.find((row) => row.handle === shop.tenant.handle);
    const tenantId = live?.id ?? shop.ids.tenant;
    const channelId = live?.medusaSalesChannelId ?? null;
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

  if (idsToRemove.length) {
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
  if (metadata.demo_seed === DEMO_SEED_MARKER) return true;
  if (metadata.platform_tenant_id === tenantId) return true;
  if (metadata.shop_handle === handle) return true;
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
    salesChannelId,
    tenantId,
  });
  await cleanDemoDraftOrders({ demoEmails, handle, salesChannelId, tenantId });

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
  for await (const category of paginateMedusaList<{
    handle?: string | null;
    id: string;
    metadata?: Record<string, unknown>;
  }>("/admin/product-categories", "product_categories", "id,handle,metadata")) {
    if (
      isDemoMetadata(category.metadata, tenantId, handle) ||
      (category.handle && shopCategoryHandles.has(category.handle))
    ) {
      await medusaDelete(`/admin/product-categories/${encodeURIComponent(category.id)}`);
      summary.categories += 1;
    }
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
 * Resolve Medusa Postgres URL without requiring a separate env var.
 * Loads apps/medusa/.env DATABASE_URL when present; normalizes mistaken http:// schemes.
 */
function resolveMedusaDatabaseUrl() {
  // Prefer explicit medusa URL; avoid platform API DATABASE_URL if it points at platform_db.
  const candidates = [
    process.env.MEDUSA_DATABASE_URL,
    process.env.MEDUSA_DB_URL,
    // Only use DATABASE_URL when it clearly targets medusa.
    process.env.DATABASE_URL?.includes("medusa") ? process.env.DATABASE_URL : undefined,
  ];

  // apps/medusa/.env is the canonical local source.
  try {
    const medusaEnvPath = resolve(
      getPlatformApiServiceDir(import.meta.url),
      "../medusa/.env",
    );
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
    // Common misconfig: http://user:pass@host/db
    if (url.startsWith("http://") || url.startsWith("https://")) {
      url = url.replace(/^https?:\/\//, "postgres://");
    }
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return url;
    }
  }

  return "postgres://ecs:ecs@localhost:5432/medusa_db";
}

async function loadPgModule() {
  try {
    return await import("pg");
  } catch {
    // platform-api may not list pg; resolve via @ecs/db which depends on it.
    const { createRequire } = await import("node:module");
    const { pathToFileURL } = await import("node:url");
    const require = createRequire(
      resolve(getPlatformApiServiceDir(import.meta.url), "../../packages/db/package.json"),
    );
    const pgPath = require.resolve("pg");
    return import(pathToFileURL(pgPath).href);
  }
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
