import { loadServiceEnv } from "@ecs/config";
import {
  accounts,
  analyticsEvents,
  createPlatformDb,
  dailyMetrics,
  domains,
  invoices,
  plans,
  storefrontConfigs,
  storefrontRevisions,
  subscriptions,
  tenantMemberships,
  tenantOnboarding,
  tenants,
  users,
} from "@ecs/db";
import { storefrontTemplates } from "@ecs/storefront-templates";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import { loadPlatformApiEnvFiles } from "../config/env.js";
import { buildPlatformSeed } from "./demo-tenant-data.js";

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
const medusaAdminApiToken = process.env.MEDUSA_ADMIN_API_TOKEN;
const platformInternalApiToken =
  process.env.PLATFORM_INTERNAL_API_TOKEN ??
  (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token");

const seed = buildPlatformSeed({
  storefrontBaseDomain: process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me",
  medusaPublishableKeyId: process.env.SEED_MEDUSA_PUBLISHABLE_KEY_ID ?? "pk_test_local_selam",
  templates: storefrontTemplates,
});
const seedOwnerPassword = process.env.SEED_OWNER_PASSWORD ?? "password1234";
const allowPartialDemoSeed = process.env.SEED_DEMO_ALLOW_PARTIAL === "true";
const storefrontBaseDomain = (process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me")
  .trim()
  .replace(/\.$/, "")
  .toLowerCase();
const demoStorefrontTemplate = seed.templates[0];
const demoStorefrontTemplateVersion = seed.templateVersions[0];

const secondDemoShop = {
  ids: {
    tenant: "20000000-0000-4000-8000-000000000001",
    domain: "20000000-0000-4000-8000-000000000002",
    storefrontRevision: "20000000-0000-4000-8000-000000000003",
    storefrontConfig: "20000000-0000-4000-8000-000000000004",
    user: "20000000-0000-4000-8000-000000000005",
    tenantMembership: "20000000-0000-4000-8000-000000000006",
    tenantOnboarding: "20000000-0000-4000-8000-000000000007",
    subscription: "20000000-0000-4000-8000-000000000008",
    invoicePaid: "20000000-0000-4000-8000-000000000009",
    invoiceOpen: "20000000-0000-4000-8000-000000000010",
  },
  tenant: {
    handle: "meklit-home",
    name: "Meklit Home Studio",
  },
  user: {
    email: "meklit.gebremedhin@example.com",
    name: "Meklit Gebremedhin",
    phone: "+251911420510",
  },
} as const;

const demoIds = {
  plan: "10000000-0000-4000-8000-000000000001",
  subscription: "10000000-0000-4000-8000-000000000002",
  invoicePaid: "10000000-0000-4000-8000-000000000003",
  invoiceOpen: "10000000-0000-4000-8000-000000000004",
  invoiceDraft: "10000000-0000-4000-8000-000000000005",
} as const;

const demoMetricKeys = [
  "overview.revenue",
  "overview.orders",
  "overview.customers",
  "overview.products",
  "overview.attention.unfulfilled",
  "overview.attention.unpaid",
  "overview.attention.draft_products",
  "overview.order_status",
  "overview.payment_status",
  "overview.fulfillment_status",
] as const;

const demoEventTypes = [
  "storefront.page_view",
  "storefront.product_viewed",
  "storefront.collection_viewed",
  "storefront.cart_created",
  "storefront.checkout_started",
  "storefront.search_performed",
] as const;
const demoOrderIdempotencyKeys = Array.from({ length: 18 }, (_, index) => `demo:order:${index}`);
const studioOrderIdempotencyKeys = Array.from(
  { length: 16 },
  (_, index) => `demo:studio:order:${index}`,
);

async function main() {
  if (process.argv.includes("--clean")) {
    await cleanDemoData();
    console.log(
      JSON.stringify(
        { cleaned: { service: env.SERVICE_NAME, tenant: seed.tenant.handle } },
        null,
        2,
      ),
    );
  } else {
    const commerce = await seedDemoData();
    console.log(
      JSON.stringify(
        {
          seeded: {
            commerce,
            service: env.SERVICE_NAME,
            tenant: seed.tenant.handle,
            dashboard: `http://${seed.domain.hostname}/admin`,
            user: seed.user.email,
          },
        },
        null,
        2,
      ),
    );
  }
}

async function seedDemoData() {
  await cleanDemoData();
  const commerce = await seedCommerceDemoData(primaryCommerceContext());

  const now = new Date();
  const periodStart = addDays(now, -14);
  const periodEnd = addDays(now, 16);

  await platformDb.db
    .insert(plans)
    .values({
      id: demoIds.plan,
      name: "Growth",
      price: "2499",
      limits: {
        products: 2500,
        staff: 8,
        storefrontEvents: 100000,
      },
      features: {
        analytics: true,
        managedCheckout: true,
        localDelivery: true,
      },
      status: "active",
    })
    .onConflictDoUpdate({
      target: plans.id,
      set: {
        features: {
          analytics: true,
          managedCheckout: true,
          localDelivery: true,
        },
        limits: {
          products: 2500,
          staff: 8,
          storefrontEvents: 100000,
        },
        name: "Growth",
        price: "2499",
        status: "active",
      },
    });

  await platformDb.db
    .insert(subscriptions)
    .values({
      id: demoIds.subscription,
      tenantId: seed.tenant.id,
      planId: demoIds.plan,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      manualPaymentState: "paid",
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        billingCycle: "monthly",
        currentPeriodEnd: periodEnd,
        currentPeriodStart: periodStart,
        manualPaymentState: "paid",
        planId: demoIds.plan,
        status: "active",
        tenantId: seed.tenant.id,
      },
    });

  await platformDb.db.insert(invoices).values([
    {
      id: demoIds.invoicePaid,
      tenantId: seed.tenant.id,
      subscriptionId: demoIds.subscription,
      amount: "2499",
      currency: "ETB",
      status: "paid",
      dueAt: addDays(now, -8),
      paidAt: addDays(now, -8),
      provider: "manual",
      providerReference: "DEMO-INV-001",
      createdAt: addDays(now, -10),
    },
    {
      id: demoIds.invoiceOpen,
      tenantId: seed.tenant.id,
      subscriptionId: demoIds.subscription,
      amount: "2499",
      currency: "ETB",
      status: "pending",
      dueAt: addDays(now, 20),
      paidAt: null,
      provider: "manual",
      providerReference: "DEMO-INV-002",
      createdAt: addDays(now, -1),
    },
    {
      id: demoIds.invoiceDraft,
      tenantId: seed.tenant.id,
      subscriptionId: demoIds.subscription,
      amount: "799",
      currency: "ETB",
      status: "draft",
      dueAt: addDays(now, 29),
      paidAt: null,
      provider: "manual",
      providerReference: "DEMO-ADDON-001",
      createdAt: now,
    },
  ]);

  await platformDb.db.insert(dailyMetrics).values(buildDemoMetricRows(seed.tenant.id, now));
  await platformDb.db.insert(analyticsEvents).values(buildDemoEvents(seed.tenant.id, now));
  const secondShop = await seedSecondDemoShop({ now, periodEnd, periodStart });
  const commerceResults: Array<[string, DemoCommerceSeedResult]> = [
    ["primary", commerce],
    ["secondary", secondShop.commerce],
  ];
  const skippedCommerce = commerceResults.filter(
    (entry): entry is [string, Extract<DemoCommerceSeedResult, { skipped: true }>] => {
      const result = entry[1];

      return result.skipped;
    },
  );

  if (skippedCommerce.length > 0 && !allowPartialDemoSeed) {
    throw new Error(
      `Demo commerce seed incomplete: ${skippedCommerce
        .map(([label, result]) => `${label}: ${result.reason}`)
        .join(
          "; ",
        )}. Start Medusa on ${medusaInternalUrl} or set SEED_DEMO_ALLOW_PARTIAL=true for platform-only seed data.`,
    );
  }

  return {
    primary: commerce,
    secondary: secondShop.commerce,
  };
}

async function cleanDemoData() {
  await cleanCommerceDemoData(primaryCommerceContext());
  await cleanCommerceDemoData(secondCommerceContext());
  await platformDb.db.delete(analyticsEvents).where(eq(analyticsEvents.tenantId, seed.tenant.id));
  await platformDb.db
    .delete(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, seed.tenant.id),
        inArray(dailyMetrics.metricKey, [...demoMetricKeys]),
      ),
    );
  await platformDb.db.delete(invoices).where(inArray(invoices.id, Object.values(demoIds).slice(2)));
  await platformDb.db.delete(subscriptions).where(eq(subscriptions.id, demoIds.subscription));
  await cleanSecondDemoShop();
  await platformDb.db.delete(plans).where(eq(plans.id, demoIds.plan));
}

async function seedSecondDemoShop(input: { now: Date; periodEnd: Date; periodStart: Date }) {
  if (!demoStorefrontTemplate || !demoStorefrontTemplateVersion) {
    throw new Error("Platform demo seed data did not include a storefront template.");
  }

  const tenant = {
    id: secondDemoShop.ids.tenant,
    name: secondDemoShop.tenant.name,
    handle: secondDemoShop.tenant.handle,
    status: "active" as const,
    primaryDomainId: secondDemoShop.ids.domain,
    medusaStoreId: `store_local_${secondDemoShop.tenant.handle}`,
    medusaSalesChannelId: `sc_local_${secondDemoShop.tenant.handle}`,
    medusaPublishableKeyId:
      process.env.SEED_SECOND_MEDUSA_PUBLISHABLE_KEY_ID ?? "pk_test_local_meklit_home",
    medusaStockLocationId: `sloc_local_${secondDemoShop.tenant.handle}`,
    medusaRegionId: `reg_local_${secondDemoShop.tenant.handle}`,
    medusaShippingProfileId: `shp_local_${secondDemoShop.tenant.handle}`,
    medusaFulfillmentSetId: `fuset_local_${secondDemoShop.tenant.handle}`,
    medusaServiceZoneId: `serzo_local_${secondDemoShop.tenant.handle}`,
    medusaShippingOptionId: `so_local_${secondDemoShop.tenant.handle}`,
  };
  const domain = {
    id: secondDemoShop.ids.domain,
    tenantId: secondDemoShop.ids.tenant,
    hostname: `${secondDemoShop.tenant.handle}.${storefrontBaseDomain}`,
    type: "platform",
    status: "active",
    isPrimary: true,
    verificationStatus: "verified",
    sslStatus: "active",
  };
  const user = {
    id: secondDemoShop.ids.user,
    email: secondDemoShop.user.email,
    emailVerified: true,
    image: null,
    phone: secondDemoShop.user.phone,
    name: secondDemoShop.user.name,
    status: "active",
  };
  const storefrontRevision = {
    id: secondDemoShop.ids.storefrontRevision,
    tenantId: secondDemoShop.ids.tenant,
    templateId: demoStorefrontTemplate.id,
    templateVersion: demoStorefrontTemplateVersion.version,
    templateKey: demoStorefrontTemplateVersion.templateKey,
    data: demoStorefrontTemplateVersion.defaultData,
    themeTokens: demoStorefrontTemplateVersion.defaultThemeTokens,
  };

  await platformDb.db
    .insert(tenants)
    .values(tenant)
    .onConflictDoUpdate({
      target: tenants.handle,
      set: {
        name: tenant.name,
        status: tenant.status,
        primaryDomainId: tenant.primaryDomainId,
        medusaStoreId: tenant.medusaStoreId,
        medusaSalesChannelId: tenant.medusaSalesChannelId,
        medusaPublishableKeyId: tenant.medusaPublishableKeyId,
        medusaStockLocationId: tenant.medusaStockLocationId,
        medusaRegionId: tenant.medusaRegionId,
        medusaShippingProfileId: tenant.medusaShippingProfileId,
        medusaFulfillmentSetId: tenant.medusaFulfillmentSetId,
        medusaServiceZoneId: tenant.medusaServiceZoneId,
        medusaShippingOptionId: tenant.medusaShippingOptionId,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(domains)
    .values(domain)
    .onConflictDoUpdate({
      target: domains.hostname,
      set: {
        tenantId: domain.tenantId,
        type: domain.type,
        status: domain.status,
        isPrimary: domain.isPrimary,
        verificationStatus: domain.verificationStatus,
        sslStatus: domain.sslStatus,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(users)
    .values(user)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        emailVerified: user.emailVerified,
        image: user.image,
        name: user.name,
        phone: user.phone,
        status: user.status,
        updatedAt: new Date(),
      },
    });

  const passwordHash = await hashPassword(seedOwnerPassword);

  await platformDb.db
    .insert(accounts)
    .values({
      id: `${user.id}:credential`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: {
        accountId: user.id,
        password: passwordHash,
        providerId: "credential",
        updatedAt: new Date(),
        userId: user.id,
      },
    });

  await platformDb.db
    .insert(tenantMemberships)
    .values({
      id: secondDemoShop.ids.tenantMembership,
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
      status: "active",
    })
    .onConflictDoUpdate({
      target: tenantMemberships.id,
      set: {
        role: "owner",
        status: "active",
        tenantId: tenant.id,
        userId: user.id,
      },
    });

  await platformDb.db
    .insert(tenantOnboarding)
    .values({
      id: secondDemoShop.ids.tenantOnboarding,
      tenantId: tenant.id,
      status: "completed",
      currentStep: "launch",
      completedSteps: [
        "commerce_resources_provisioned",
        "storefront_template_preselected",
        "launch",
      ],
    })
    .onConflictDoUpdate({
      target: tenantOnboarding.tenantId,
      set: {
        completedSteps: [
          "commerce_resources_provisioned",
          "storefront_template_preselected",
          "launch",
        ],
        currentStep: "launch",
        status: "completed",
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(storefrontRevisions)
    .values(storefrontRevision)
    .onConflictDoUpdate({
      target: storefrontRevisions.id,
      set: {
        data: storefrontRevision.data,
        templateId: storefrontRevision.templateId,
        templateKey: storefrontRevision.templateKey,
        templateVersion: storefrontRevision.templateVersion,
        tenantId: storefrontRevision.tenantId,
        themeTokens: storefrontRevision.themeTokens,
      },
    });

  await platformDb.db
    .insert(storefrontConfigs)
    .values({
      id: secondDemoShop.ids.storefrontConfig,
      tenantId: tenant.id,
      draftTemplateId: demoStorefrontTemplate.id,
      draftTemplateVersion: demoStorefrontTemplateVersion.version,
      draftData: demoStorefrontTemplateVersion.defaultData,
      draftThemeTokens: demoStorefrontTemplateVersion.defaultThemeTokens,
      publishedRevisionId: storefrontRevision.id,
      publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    })
    .onConflictDoUpdate({
      target: storefrontConfigs.id,
      set: {
        draftData: demoStorefrontTemplateVersion.defaultData,
        draftTemplateId: demoStorefrontTemplate.id,
        draftTemplateVersion: demoStorefrontTemplateVersion.version,
        draftThemeTokens: demoStorefrontTemplateVersion.defaultThemeTokens,
        publishedAt: new Date("2026-02-01T00:00:00.000Z"),
        publishedRevisionId: storefrontRevision.id,
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
    });

  await platformDb.db
    .insert(subscriptions)
    .values({
      id: secondDemoShop.ids.subscription,
      tenantId: tenant.id,
      planId: demoIds.plan,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: input.periodStart,
      currentPeriodEnd: input.periodEnd,
      manualPaymentState: "paid",
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        billingCycle: "monthly",
        currentPeriodEnd: input.periodEnd,
        currentPeriodStart: input.periodStart,
        manualPaymentState: "paid",
        planId: demoIds.plan,
        status: "active",
        tenantId: tenant.id,
      },
    });

  await platformDb.db.insert(invoices).values([
    {
      id: secondDemoShop.ids.invoicePaid,
      tenantId: tenant.id,
      subscriptionId: secondDemoShop.ids.subscription,
      amount: "2499",
      currency: "ETB",
      status: "paid",
      dueAt: addDays(input.now, -4),
      paidAt: addDays(input.now, -4),
      provider: "manual",
      providerReference: "MEKLIT-INV-001",
      createdAt: addDays(input.now, -7),
    },
    {
      id: secondDemoShop.ids.invoiceOpen,
      tenantId: tenant.id,
      subscriptionId: secondDemoShop.ids.subscription,
      amount: "2499",
      currency: "ETB",
      status: "pending",
      dueAt: addDays(input.now, 24),
      paidAt: null,
      provider: "manual",
      providerReference: "MEKLIT-INV-002",
      createdAt: addDays(input.now, -2),
    },
  ]);

  await platformDb.db.insert(dailyMetrics).values(buildStudioMetricRows(tenant.id, input.now));
  await platformDb.db
    .insert(analyticsEvents)
    .values(buildDemoEvents(tenant.id, input.now, "meklit"));

  return {
    commerce: await seedCommerceDemoData(secondCommerceContext()),
    dashboard: `http://${domain.hostname}/admin`,
    user: user.email,
  };
}

async function cleanSecondDemoShop() {
  await platformDb.db
    .delete(analyticsEvents)
    .where(eq(analyticsEvents.tenantId, secondDemoShop.ids.tenant));
  await platformDb.db
    .delete(dailyMetrics)
    .where(eq(dailyMetrics.tenantId, secondDemoShop.ids.tenant));
  await platformDb.db
    .delete(invoices)
    .where(inArray(invoices.id, [secondDemoShop.ids.invoicePaid, secondDemoShop.ids.invoiceOpen]));
  await platformDb.db
    .delete(subscriptions)
    .where(eq(subscriptions.id, secondDemoShop.ids.subscription));
  await platformDb.db
    .delete(storefrontConfigs)
    .where(eq(storefrontConfigs.id, secondDemoShop.ids.storefrontConfig));
  await platformDb.db
    .delete(storefrontRevisions)
    .where(eq(storefrontRevisions.id, secondDemoShop.ids.storefrontRevision));
  await platformDb.db
    .delete(tenantOnboarding)
    .where(eq(tenantOnboarding.tenantId, secondDemoShop.ids.tenant));
  await platformDb.db
    .delete(tenantMemberships)
    .where(eq(tenantMemberships.id, secondDemoShop.ids.tenantMembership));
  await platformDb.db.delete(domains).where(eq(domains.id, secondDemoShop.ids.domain));
  await platformDb.db.delete(tenants).where(eq(tenants.id, secondDemoShop.ids.tenant));
  await platformDb.db
    .delete(accounts)
    .where(eq(accounts.id, `${secondDemoShop.ids.user}:credential`));
  await platformDb.db.delete(users).where(eq(users.id, secondDemoShop.ids.user));
}

async function seedCommerceDemoData(context: DemoCommerceContext) {
  if (!medusaAdminApiToken?.trim()) {
    console.warn(
      "[seed:demo] MEDUSA_ADMIN_API_TOKEN is not set — commerce demo data will be skipped. Run `pnpm --filter @ecs/medusa seed` first and export the token.",
    );
    return {
      skipped: true,
      reason: "MEDUSA_ADMIN_API_TOKEN is not set",
    } satisfies DemoCommerceSeedResult;
  }

  const resources = await ensureTenantCommerceResources(context);

  if (!resources.ok) {
    return {
      skipped: true,
      reason: resources.reason,
    } satisfies DemoCommerceSeedResult;
  }

  const categories = await createDemoCategories(context);
  const collections = await createDemoCollections(context);
  const products = await createDemoProducts({
    categories,
    collections,
    context,
    resources: resources.resources,
  });
  const orders = await createDemoOrders({ context, products, resources: resources.resources });

  return {
    skipped: false,
    categories: categories.length,
    collections: collections.length,
    orders,
    products: products.length,
  } satisfies DemoCommerceSeedResult;
}

async function cleanCommerceDemoData(context: DemoCommerceContext) {
  if (!medusaAdminApiToken?.trim()) {
    return;
  }

  const orders = await medusaList<{
    orders?: Array<{ id: string; metadata?: Record<string, unknown> }>;
  }>("/admin/orders?limit=100&fields=id,metadata");

  for (const order of orders?.orders ?? []) {
    if (
      order.metadata?.demo_seed === "ecs-dashboard" &&
      order.metadata.platform_tenant_id === context.tenantId
    ) {
      await medusaPost(`/admin/orders/${encodeURIComponent(order.id)}/archive`, {});
    }
  }

  const products = await medusaList<{
    products?: Array<{ id: string; metadata?: Record<string, unknown> }>;
  }>("/admin/products?limit=100&fields=id,metadata");

  for (const product of products?.products ?? []) {
    if (
      product.metadata?.demo_seed === "ecs-dashboard" &&
      product.metadata.platform_tenant_id === context.tenantId
    ) {
      await medusaDelete(`/admin/products/${encodeURIComponent(product.id)}`);
    }
  }

  const collections = await medusaList<{
    collections?: Array<{ id: string; metadata?: Record<string, unknown> }>;
  }>("/admin/collections?limit=100&fields=id,metadata");

  for (const collection of collections?.collections ?? []) {
    if (
      collection.metadata?.demo_seed === "ecs-dashboard" &&
      collection.metadata.platform_tenant_id === context.tenantId
    ) {
      await medusaDelete(`/admin/collections/${encodeURIComponent(collection.id)}`);
    }
  }

  const categories = await medusaList<{
    product_categories?: Array<{ id: string; metadata?: Record<string, unknown> }>;
  }>("/admin/product-categories?limit=100&fields=id,metadata");

  for (const category of categories?.product_categories ?? []) {
    if (
      category.metadata?.demo_seed === "ecs-dashboard" &&
      category.metadata.platform_tenant_id === context.tenantId
    ) {
      await medusaDelete(`/admin/product-categories/${encodeURIComponent(category.id)}`);
    }
  }
}

async function ensureTenantCommerceResources(context: DemoCommerceContext) {
  if (!platformInternalApiToken?.trim()) {
    return {
      ok: false,
      reason: "PLATFORM_INTERNAL_API_TOKEN is not set",
    } satisfies TenantCommerceResourceResult;
  }

  const response = await fetch(`${medusaInternalUrl}/internal/platform/provision-tenant`, {
    body: JSON.stringify({
      handle: context.handle,
      name: context.name,
      platformTenantId: context.tenantId,
      requestedByUserId: context.userId,
    }),
    headers: {
      "content-type": "application/json",
      "x-platform-internal-token": platformInternalApiToken,
    },
    method: "POST",
  }).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "unknown network error",
  }));

  if (!("ok" in response)) {
    return {
      ok: false,
      reason: `Medusa is not reachable at ${medusaInternalUrl}: ${response.error}`,
    } satisfies TenantCommerceResourceResult;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    return {
      ok: false,
      reason: `Medusa provisioning returned ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`,
    } satisfies TenantCommerceResourceResult;
  }

  const body = (await response.json().catch(() => undefined)) as
    | {
        resources?: TenantCommerceResources;
      }
    | undefined;
  const resources = body?.resources;

  if (!resources) {
    return {
      ok: false,
      reason: "Medusa provisioning returned an invalid response body",
    } satisfies TenantCommerceResourceResult;
  }

  await platformDb.db
    .update(tenants)
    .set({
      medusaFulfillmentSetId: resources.fulfillmentSetId,
      medusaPublishableKeyId: resources.publishableKeyId,
      medusaRegionId: resources.regionId,
      medusaSalesChannelId: resources.salesChannelId,
      medusaServiceZoneId: resources.serviceZoneId,
      medusaShippingOptionId: resources.shippingOptionId,
      medusaShippingProfileId: resources.shippingProfileId,
      medusaStockLocationId: resources.stockLocationId,
      medusaStoreId: resources.storeId,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, context.tenantId));

  return {
    ok: true,
    resources,
  } satisfies TenantCommerceResourceResult;
}

async function createDemoCategories(context: DemoCommerceContext) {
  const rows: Array<{ id: string; name: string }> = [];

  for (const input of context.categories) {
    const result = await medusaPost<{ product_category?: { id: string; name: string } }>(
      "/admin/product-categories",
      {
        ...input,
        is_active: true,
        is_internal: false,
        metadata: demoMetadata(context),
      },
    );

    if (result?.product_category) {
      rows.push(result.product_category);
    }
  }

  return rows;
}

async function createDemoCollections(context: DemoCommerceContext) {
  const rows: Array<{ id: string; title: string }> = [];

  for (const input of context.collections) {
    const result = await medusaPost<{ collection?: { id: string; title: string } }>(
      "/admin/collections",
      {
        ...input,
        metadata: demoMetadata(context),
      },
    );

    if (result?.collection) {
      rows.push(result.collection);
    }
  }

  return rows;
}

async function createDemoProducts(input: {
  categories: Array<{ id: string }>;
  collections: Array<{ id: string }>;
  context: DemoCommerceContext;
  resources: TenantCommerceResources;
}) {
  const created: MedusaProductSeedResult[] = [];

  for (const product of buildDemoProducts(input)) {
    const result = await medusaPost<{ product?: MedusaProductSeedResult }>(
      "/admin/products",
      product,
    );

    if (result?.product) {
      created.push(result.product);
    }
  }

  return created;
}

async function createDemoOrders(input: {
  context: DemoCommerceContext;
  products: MedusaProductSeedResult[];
  resources: TenantCommerceResources;
}) {
  let created = 0;
  const variants = input.products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      productTitle: product.title,
      variantId: variant.id,
    })),
  );

  for (
    let index = 0;
    index < Math.min(input.context.orderIdempotencyKeys.length, variants.length);
    index += 1
  ) {
    const variant = variants[index];

    if (!variant) {
      continue;
    }

    const result = await medusaPost<{ draft_order?: { id: string } }>("/admin/draft-orders", {
      email: input.context.customers[index % input.context.customers.length]?.email,
      region_id: input.resources.regionId,
      sales_channel_id: input.resources.salesChannelId,
      status: index % 7 === 0 ? "pending" : "completed",
      billing_address: demoAddress(input.context, index),
      shipping_address: demoAddress(input.context, index),
      items: [
        {
          variant_id: variant.variantId,
          title: variant.productTitle,
          quantity: (index % 3) + 1,
          unit_price: 480 + index * 35,
        },
      ],
      metadata: {
        ...demoMetadata(input.context),
        idempotency_key: input.context.orderIdempotencyKeys[index],
      },
    });

    if (result?.draft_order) {
      created += 1;
    }
  }

  return created;
}

function buildDemoProducts(input: {
  categories: Array<{ id: string }>;
  collections: Array<{ id: string }>;
  context: DemoCommerceContext;
  resources: TenantCommerceResources;
}) {
  return input.context.products.map((product, index) => {
    const category = input.categories[index % input.categories.length];
    const collection = input.collections[index % input.collections.length];

    return {
      title: product.title,
      handle: product.handle,
      subtitle: product.subtitle,
      description: product.description,
      status: "published",
      thumbnail: product.image,
      images: [{ url: product.image }],
      categories: category ? [{ id: category.id }] : [],
      collection_id: collection?.id,
      sales_channels: [{ id: input.resources.salesChannelId }],
      shipping_profile_id: input.resources.shippingProfileId,
      options: [
        {
          title: product.optionTitle,
          values: product.variants.map((variant) => variant.option),
        },
      ],
      variants: product.variants.map((variant) => ({
        title: variant.title,
        sku: variant.sku,
        manage_inventory: false,
        options: {
          [product.optionTitle]: variant.option,
        },
        prices: [
          {
            amount: variant.price,
            currency_code: "etb",
          },
        ],
      })),
      metadata: demoMetadata(input.context),
    };
  });
}

function buildDemoMetricRows(tenantId: string, now: Date) {
  const rows: Array<typeof dailyMetrics.$inferInsert> = [];

  for (let index = 29; index >= 0; index -= 1) {
    const date = addDays(now, -index).toISOString().slice(0, 10);
    const day = 29 - index;
    const weekendLift = day % 7 === 4 || day % 7 === 5 ? 1.22 : 1;
    const campaignLift = day > 18 ? 1.18 : 1;
    const orders = Math.round(
      (14 + day * 0.7 + Math.sin(day / 2) * 4) * weekendLift * campaignLift,
    );
    const averageOrderValue = 620 + (day % 6) * 35 + (day > 20 ? 80 : 0);
    const revenue = orders * averageOrderValue;
    const customers = Math.max(8, Math.round(orders * 0.72));

    rows.push(
      metricRow(tenantId, date, "overview.revenue", revenue),
      metricRow(tenantId, date, "overview.orders", orders),
      metricRow(tenantId, date, "overview.customers", customers),
    );
  }

  rows.push(
    metricRow(tenantId, latestMetricDate(now), "overview.products", 186),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.unfulfilled", 9),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.unpaid", 5),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.draft_products", 7),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 74, "status", "completed"),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 18, "status", "pending"),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 8, "status", "canceled"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 82, "status", "paid"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 13, "status", "awaiting"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 5, "status", "refunded"),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      61,
      "status",
      "delivered",
    ),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      22,
      "status",
      "packed",
    ),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      17,
      "status",
      "not_fulfilled",
    ),
  );

  return rows;
}

function buildStudioMetricRows(tenantId: string, now: Date) {
  const rows: Array<typeof dailyMetrics.$inferInsert> = [];

  for (let index = 29; index >= 0; index -= 1) {
    const date = addDays(now, -index).toISOString().slice(0, 10);
    const day = 29 - index;
    const appointmentLift = day % 7 === 5 || day % 7 === 6 ? 1.35 : 1;
    const orders = Math.round((8 + day * 0.45 + Math.cos(day / 3) * 2.5) * appointmentLift);
    const averageOrderValue = 980 + (day % 5) * 90 + (day > 17 ? 140 : 0);
    const revenue = orders * averageOrderValue;
    const customers = Math.max(5, Math.round(orders * 0.64));

    rows.push(
      metricRow(tenantId, date, "overview.revenue", revenue),
      metricRow(tenantId, date, "overview.orders", orders),
      metricRow(tenantId, date, "overview.customers", customers),
    );
  }

  rows.push(
    metricRow(tenantId, latestMetricDate(now), "overview.products", 92),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.unfulfilled", 4),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.unpaid", 2),
    metricRow(tenantId, latestMetricDate(now), "overview.attention.draft_products", 3),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 58, "status", "completed"),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 12, "status", "pending"),
    metricRow(tenantId, latestMetricDate(now), "overview.order_status", 3, "status", "canceled"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 62, "status", "paid"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 9, "status", "awaiting"),
    metricRow(tenantId, latestMetricDate(now), "overview.payment_status", 2, "status", "refunded"),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      49,
      "status",
      "delivered",
    ),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      14,
      "status",
      "packed",
    ),
    metricRow(
      tenantId,
      latestMetricDate(now),
      "overview.fulfillment_status",
      10,
      "status",
      "not_fulfilled",
    ),
  );

  return rows;
}

function buildDemoEvents(tenantId: string, now: Date, prefix = "selam") {
  return demoEventTypes.flatMap((eventType, eventIndex) =>
    Array.from({ length: 12 }, (_, index) => ({
      tenantId,
      eventType,
      source: "storefront" as const,
      subjectType: eventType.includes("product") ? "product" : "storefront",
      subjectId: eventType.includes("product") ? `demo_product_${index % 5}` : "demo_storefront",
      occurredAt: addDays(now, -(index + eventIndex)),
      receivedAt: addDays(now, -(index + eventIndex)),
      idempotencyKey: `demo:${prefix}:${eventType}:${index}`,
      sessionIdHash: `demo_${prefix}_session_${eventIndex}_${index}`,
      customerId: index % 3 === 0 ? `demo_${prefix}_customer_${index}` : null,
      properties: {
        demo: true,
        referrer: index % 2 === 0 ? "instagram" : "direct",
      },
    })),
  );
}

function primaryCommerceContext(): DemoCommerceContext {
  return {
    categories: demoCategories,
    collections: demoCollections,
    customers: demoCustomers,
    handle: seed.tenant.handle,
    name: seed.tenant.name,
    orderIdempotencyKeys: demoOrderIdempotencyKeys,
    products: demoProducts,
    tenantId: seed.tenant.id,
    userId: seed.user.id,
  };
}

function secondCommerceContext(): DemoCommerceContext {
  return {
    categories: studioCategories,
    collections: studioCollections,
    customers: studioCustomers,
    handle: secondDemoShop.tenant.handle,
    name: secondDemoShop.tenant.name,
    orderIdempotencyKeys: studioOrderIdempotencyKeys,
    products: studioProducts,
    tenantId: secondDemoShop.ids.tenant,
    userId: secondDemoShop.ids.user,
  };
}

async function medusaList<T>(path: string): Promise<T | null> {
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
  init: {
    body?: string;
    method: "DELETE" | "GET" | "POST";
  },
): Promise<T | null> {
  if (!medusaAdminApiToken?.trim()) {
    return null;
  }

  const requestInit: RequestInit = {
    headers: {
      accept: "application/json",
      authorization: `Basic ${medusaAdminApiToken}`,
      "content-type": "application/json",
    },
    method: init.method,
  };

  if (init.body !== undefined) {
    requestInit.body = init.body;
  }

  const response = await fetch(`${medusaInternalUrl}${path}`, requestInit).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json().catch(() => null)) as T | null;
}

function demoMetadata(context: DemoCommerceContext) {
  return {
    demo_seed: "ecs-dashboard",
    platform_tenant_id: context.tenantId,
  };
}

function demoAddress(context: DemoCommerceContext, index: number) {
  const customer = context.customers[index % context.customers.length] ?? context.customers[0];

  if (!customer) {
    throw new Error(`Demo commerce context ${context.handle} does not include customers.`);
  }

  return {
    first_name: customer.firstName,
    last_name: customer.lastName,
    address_1: customer.address,
    city: "Addis Ababa",
    province: customer.area,
    country_code: "et",
    postal_code: "1000",
    phone: customer.phone,
  };
}

function metricRow(
  tenantId: string,
  date: string,
  metricKey: (typeof demoMetricKeys)[number],
  value: number,
  dimensionKey?: string,
  dimensionValue?: string,
): typeof dailyMetrics.$inferInsert {
  return {
    tenantId,
    date,
    metricKey,
    dimensionKey: dimensionKey ?? null,
    dimensionValue: dimensionValue ?? null,
    value: String(value),
  };
}

function latestMetricDate(now: Date) {
  return now.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

type TenantCommerceResources = {
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

type TenantCommerceResourceResult =
  | {
      ok: true;
      resources: TenantCommerceResources;
    }
  | {
      ok: false;
      reason: string;
    };

type DemoCommerceSeedResult =
  | {
      skipped: false;
      categories: number;
      collections: number;
      orders: number;
      products: number;
    }
  | {
      skipped: true;
      reason: string;
    };

type MedusaProductSeedResult = {
  id: string;
  title: string;
  variants?: Array<{
    id: string;
    title: string;
  }>;
};

type DemoCommerceContext = {
  categories: ReadonlyArray<{ handle: string; name: string }>;
  collections: ReadonlyArray<{ handle: string; title: string }>;
  customers: ReadonlyArray<DemoCustomer>;
  handle: string;
  name: string;
  orderIdempotencyKeys: readonly string[];
  products: ReadonlyArray<DemoProduct>;
  tenantId: string;
  userId: string;
};

type DemoCustomer = {
  address: string;
  area: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type DemoProduct = ReturnType<typeof productSeed>;

const demoCategories = [
  { name: "Coffee & Tea", handle: "demo-coffee-tea" },
  { name: "Pantry Staples", handle: "demo-pantry-staples" },
  { name: "Home Goods", handle: "demo-home-goods" },
  { name: "Fresh Market", handle: "demo-fresh-market" },
] as const;

const demoCollections = [
  { title: "Bestsellers", handle: "demo-bestsellers" },
  { title: "New This Week", handle: "demo-new-this-week" },
  { title: "Giftable Essentials", handle: "demo-giftable-essentials" },
] as const;

const demoCustomers = [
  {
    firstName: "Mahi",
    lastName: "Tesfaye",
    email: "mahi.tesfaye@example.com",
    phone: "+251911000101",
    area: "Bole",
    address: "Bole Atlas",
  },
  {
    firstName: "Dawit",
    lastName: "Bekele",
    email: "dawit.bekele@example.com",
    phone: "+251911000102",
    area: "Kazanchis",
    address: "Kazanchis Business District",
  },
  {
    firstName: "Hana",
    lastName: "Kebede",
    email: "hana.kebede@example.com",
    phone: "+251911000103",
    area: "CMC",
    address: "CMC Michael",
  },
  {
    firstName: "Noah",
    lastName: "Alemu",
    email: "noah.alemu@example.com",
    phone: "+251911000104",
    area: "Piassa",
    address: "Arada Piassa",
  },
] as const;

/**
 * Product image URLs for demo catalog.
 * Remote placeholders on Medusa product.images (not media-library / MinIO assets).
 * Override with SEED_DEMO_IMAGE_BASE (e.g. https://picsum.photos/seed).
 */
const demoImageSeeds: Record<string, string> = {
  "Coffee & Tea": "coffee-tea",
  "Pantry Staples": "pantry",
  "Home Goods": "home-goods",
  "Fresh Market": "fresh-market",
  "Giftable Essentials": "gifts",
  "Soft Furnishings": "soft-furnishings",
  "Home Fragrance": "fragrance",
  "Dinner Party Edit": "dinner",
  "Wedding Gifts": "wedding",
};

function getDemoImageUrl(category: string) {
  const customBase = process.env.SEED_DEMO_IMAGE_BASE?.trim().replace(/\/$/, "");
  const seed = demoImageSeeds[category] ?? "gifts";
  if (customBase) {
    return `${customBase}/${encodeURIComponent(seed)}/1200/1200`;
  }
  return `https://picsum.photos/seed/${encodeURIComponent(`ecs-${seed}`)}/1200/1200`;
}

function productSeed(
  title: string,
  handle: string,
  subtitle: string,
  basePrice: number,
  options: readonly string[],
) {
  return {
    title,
    handle,
    subtitle,
    description: `${title} is a carefully selected product for Selam Market, prepared for everyday use and gifting.`,
    image: getDemoImageUrl(subtitle),
    optionTitle: "Variant",
    variants: options.map((option, index) => ({
      option,
      title: `${title} / ${option}`,
      sku: `DEMO-${handle.toUpperCase().replaceAll("-", "_")}-${index + 1}`,
      price: basePrice + index * Math.round(basePrice * 0.45),
    })),
  };
}

const demoProducts = [
  productSeed("Yirgacheffe Filter Coffee", "demo-yirgacheffe-filter-coffee", "Coffee & Tea", 680, [
    "250g",
    "500g",
  ]),
  productSeed("Sidamo Espresso Roast", "demo-sidamo-espresso-roast", "Coffee & Tea", 720, [
    "250g",
    "1kg",
  ]),
  productSeed("Ceremonial Coffee Set", "demo-ceremonial-coffee-set", "Home Goods", 1850, [
    "Clay",
    "Black",
  ]),
  productSeed("Berbere Spice Blend", "demo-berbere-spice-blend", "Pantry Staples", 240, [
    "100g",
    "250g",
  ]),
  productSeed("Mitmita Heat Mix", "demo-mitmita-heat-mix", "Pantry Staples", 210, ["100g", "250g"]),
  productSeed("White Teff Flour", "demo-white-teff-flour", "Pantry Staples", 520, ["1kg", "3kg"]),
  productSeed("Brown Teff Flour", "demo-brown-teff-flour", "Pantry Staples", 490, ["1kg", "3kg"]),
  productSeed("Acacia Honey Jar", "demo-acacia-honey-jar", "Fresh Market", 390, ["350g", "700g"]),
  productSeed("Cold Pressed Sesame Oil", "demo-sesame-oil", "Pantry Staples", 460, ["500ml", "1L"]),
  productSeed("Handwoven Cotton Towel", "demo-cotton-towel", "Home Goods", 640, [
    "Natural",
    "Indigo",
  ]),
  productSeed("Market Tote Bag", "demo-market-tote", "Home Goods", 380, ["Small", "Large"]),
  productSeed("Spiced Tea Trio", "demo-spiced-tea-trio", "Coffee & Tea", 560, [
    "Classic",
    "Gift Box",
  ]),
  productSeed("Roasted Chickpea Snack", "demo-roasted-chickpea-snack", "Fresh Market", 160, [
    "Salted",
    "Spiced",
  ]),
  productSeed("Date & Sesame Bites", "demo-date-sesame-bites", "Fresh Market", 260, [
    "6 Pack",
    "12 Pack",
  ]),
  productSeed("Handmade Incense Pack", "demo-handmade-incense-pack", "Home Goods", 180, [
    "Frankincense",
    "Myrrh",
  ]),
  productSeed("Breakfast Basket", "demo-breakfast-basket", "Giftable Essentials", 2150, [
    "Standard",
    "Premium",
  ]),
  productSeed("Coffee Lovers Bundle", "demo-coffee-lovers-bundle", "Giftable Essentials", 2890, [
    "Whole Bean",
    "Ground",
  ]),
  productSeed("Pantry Starter Box", "demo-pantry-starter-box", "Giftable Essentials", 1980, [
    "Small",
    "Family",
  ]),
] as const;

const studioCategories = [
  { name: "Table Linens", handle: "demo-studio-table-linens" },
  { name: "Ceramics", handle: "demo-studio-ceramics" },
  { name: "Home Fragrance", handle: "demo-studio-home-fragrance" },
  { name: "Soft Furnishings", handle: "demo-studio-soft-furnishings" },
] as const;

const studioCollections = [
  { title: "Dinner Party Edit", handle: "demo-studio-dinner-party-edit" },
  { title: "Quiet Living", handle: "demo-studio-quiet-living" },
  { title: "Wedding Gifts", handle: "demo-studio-wedding-gifts" },
] as const;

const studioCustomers = [
  {
    firstName: "Selam",
    lastName: "Getachew",
    email: "selam.getachew@example.com",
    phone: "+251911420601",
    area: "Old Airport",
    address: "Old Airport Residence",
  },
  {
    firstName: "Robel",
    lastName: "Haile",
    email: "robel.haile@example.com",
    phone: "+251911420602",
    area: "Megenagna",
    address: "Megenagna Square",
  },
  {
    firstName: "Liya",
    lastName: "Tadesse",
    email: "liya.tadesse@example.com",
    phone: "+251911420603",
    area: "Sarbet",
    address: "Sarbet Gabriel",
  },
  {
    firstName: "Yonas",
    lastName: "Assefa",
    email: "yonas.assefa@example.com",
    phone: "+251911420604",
    area: "Lebu",
    address: "Lebu Musika Sefer",
  },
] as const;

const studioProducts = [
  productSeed("Stoneware Dinner Plate", "demo-studio-stoneware-dinner-plate", "Ceramics", 820, [
    "Sand",
    "Charcoal",
  ]),
  productSeed("Hand-thrown Serving Bowl", "demo-studio-serving-bowl", "Ceramics", 1240, [
    "Medium",
    "Large",
  ]),
  productSeed("Linen Table Runner", "demo-studio-linen-table-runner", "Table Linens", 980, [
    "Natural",
    "Sage",
  ]),
  productSeed("Cotton Napkin Set", "demo-studio-cotton-napkin-set", "Table Linens", 760, [
    "Set of 4",
    "Set of 8",
  ]),
  productSeed("Woven Cushion Cover", "demo-studio-woven-cushion-cover", "Soft Furnishings", 690, [
    "45cm",
    "55cm",
  ]),
  productSeed("Merino Throw Blanket", "demo-studio-merino-throw", "Soft Furnishings", 2380, [
    "Oat",
    "Slate",
  ]),
  productSeed("Cedar Soy Candle", "demo-studio-cedar-soy-candle", "Home Fragrance", 540, [
    "180g",
    "320g",
  ]),
  productSeed("Amber Reed Diffuser", "demo-studio-amber-reed-diffuser", "Home Fragrance", 720, [
    "Classic",
    "Refill",
  ]),
  productSeed("Guest Towel Bundle", "demo-studio-guest-towel-bundle", "Soft Furnishings", 1180, [
    "Ivory",
    "Clay",
  ]),
  productSeed("Breakfast Tray", "demo-studio-breakfast-tray", "Dinner Party Edit", 1460, [
    "Walnut",
    "Blackened Oak",
  ]),
  productSeed("Host Gift Box", "demo-studio-host-gift-box", "Wedding Gifts", 3120, [
    "Classic",
    "Signature",
  ]),
  productSeed("Ceramic Incense Holder", "demo-studio-incense-holder", "Home Fragrance", 430, [
    "Round",
    "Ridge",
  ]),
] as const;

try {
  await main();
} finally {
  await platformDb.pool.end();
}
