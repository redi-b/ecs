import type { createPlatformDb } from "@ecs/db";
import {
  analyticsEvents,
  dailyMetrics,
  deliverySettings,
  inAppNotificationReceipts,
  inAppNotifications,
  invoices,
  metricRollupCheckpoints,
  notificationPreferences,
  organizationRoles,
  paymentOnboarding,
  storefrontInquiries,
  subscriptions,
  tenants,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";
import {
  COMMERCE_ROLLUP_KEY,
  COMMERCE_ROLLUP_VERSION,
  DEFAULT_REPORTING_TIMEZONE,
} from "../modules/analytics/commerce-rollup.js";
import { DEMO_SEED_MARKER, type DemoShopDefinition } from "./demo-shops.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const DEMO_NOTIFICATION_EVENTS = [
  "order.created",
  "order.paid",
  "order.ready_for_pickup",
  "order.out_for_delivery",
  "order.cancelled",
  "inventory.low",
  "inventory.out",
  "billing.payment_rejected",
] as const;

export async function seedPlatformExtras(
  db: PlatformDb,
  shop: DemoShopDefinition,
  tenantId: string,
  userId: string,
  commerce: Record<string, unknown>,
) {
  await db
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

  const [tenantContext] = await db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (tenantContext?.organizationId) {
    await db
      .insert(organizationRoles)
      .values({
        id: `demo:${shop.tenant.handle}:catalog-specialist`,
        organizationId: tenantContext.organizationId,
        permission: JSON.stringify({
          media: ["read", "create", "update", "delete"],
          products: ["read", "create", "update", "import", "export"],
          storefront: ["read"],
        }),
        role: "catalog-specialist",
      })
      .onConflictDoUpdate({
        target: [organizationRoles.organizationId, organizationRoles.role],
        set: {
          permission: JSON.stringify({
            media: ["read", "create", "update", "delete"],
            products: ["read", "create", "update", "import", "export"],
            storefront: ["read"],
          }),
          updatedAt: new Date(),
        },
      });
  }

  // A useful mix for the inquiries workspace: unread work, active follow-up,
  // resolved history, contact messages, and product requests.
  await db.delete(storefrontInquiries).where(eq(storefrontInquiries.tenantId, tenantId));
  const inquiryCustomers = shop.customers.slice(0, 6);
  const inquiryRows = inquiryCustomers.map((customer, index) => {
    const isRequest = index % 2 === 0;
    const createdAt = addDays(new Date(), -(index * 2 + 1));
    return {
      createdAt,
      customerEmail: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      details: isRequest
        ? {
            requestedProduct:
              shop.tenant.handle === "addistech"
                ? (["Mechanical keyboard", "Wi-Fi router", "Smart watch"][index % 3] ??
                  "New accessory")
                : (["Traditional dress", "Leather belt", "Kids collection"][index % 3] ??
                  "New collection"),
            preferredContact: index % 3 === 0 ? "phone" : "email",
          }
        : { preferredContact: "phone" },
      message: isRequest
        ? "Please let me know whether you can source this item and the expected delivery time."
        : "I would like help choosing the right option before placing my order.",
      sourcePath: isRequest ? "/request-item" : "/contact",
      status: ["new", "read", "resolved", "new", "read", "archived"][index] ?? "new",
      subject: isRequest ? "Product availability request" : "Question before ordering",
      tenantId,
      type: isRequest ? "product_request" : "contact",
      updatedAt: createdAt,
    };
  });
  if (inquiryRows.length) await db.insert(storefrontInquiries).values(inquiryRows);

  const [subscription] = await db
    .select({ id: subscriptions.id, planVersionId: subscriptions.planVersionId })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
  if (subscription) {
    const invoiceNow = new Date();
    await db.insert(invoices).values([
      {
        amount: "499",
        currency: "ETB",
        paidAt: addDays(invoiceNow, -42),
        planVersionId: subscription.planVersionId,
        provider: "manual",
        providerReference: `demo-${shop.tenant.handle}-previous`,
        status: "paid",
        subscriptionId: subscription.id,
        tenantId,
      },
      {
        amount: "499",
        currency: "ETB",
        dueAt: addDays(invoiceNow, 12),
        planVersionId: subscription.planVersionId,
        provider: "manual",
        providerReference: `demo-${shop.tenant.handle}-next`,
        status: "pending",
        subscriptionId: subscription.id,
        tenantId,
      },
    ]);
  }

  // Email preference (no Telegram destinations — needs bot connect).
  const existingPrefs = await db
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
    await db
      .update(notificationPreferences)
      .set({
        enabled: true,
        events: [...DEMO_NOTIFICATION_EVENTS],
        target: shop.user.email,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.id, existingPrefs[0].id));
  } else {
    await db.insert(notificationPreferences).values({
      tenantId,
      channel: "email",
      enabled: true,
      target: shop.user.email,
      events: [...DEMO_NOTIFICATION_EVENTS],
    });
  }

  // Payment onboarding stub (no secret — COD-only until merchant configures Chapa).
  const existingPayment = await db
    .select({ id: paymentOnboarding.id })
    .from(paymentOnboarding)
    .where(and(eq(paymentOnboarding.tenantId, tenantId), eq(paymentOnboarding.provider, "chapa")))
    .limit(1);

  if (existingPayment[0]?.id) {
    await db
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
    await db.insert(paymentOnboarding).values({
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
      body: "Order ECS-1048 was placed and is waiting for confirmation.",
      href: "/dashboard/orders",
      category: "orders",
      priority: "normal",
      readAt: null as Date | null,
    },
    {
      dedupeKey: `demo:${tenantId}:inventory.low`,
      eventType: "inventory.low",
      title: "Low stock on popular SKUs",
      body: "Two popular variants have fewer than five items available.",
      href: "/dashboard/products",
      category: "inventory",
      priority: "high",
      readAt: null as Date | null,
    },
    {
      dedupeKey: `demo:${tenantId}:payment.paid`,
      eventType: "payment.paid",
      title: "Payment received",
      body: "ETB 4,850 was recorded for order ECS-1042.",
      href: "/dashboard/orders",
      category: "orders",
      priority: "normal",
      readAt: addDays(new Date(), -1),
    },
    {
      dedupeKey: `demo:${tenantId}:order.cancelled`,
      eventType: "order.cancelled",
      title: "Order cancelled",
      body: "Order ECS-1039 was cancelled before fulfillment.",
      href: "/dashboard/orders",
      category: "orders",
      priority: "normal",
      readAt: addDays(new Date(), -2),
    },
    {
      dedupeKey: `demo:${tenantId}:inquiry.created`,
      eventType: "storefront.inquiry_created",
      title: "New product request",
      body: "A customer asked whether you can source an item that is not in the catalog.",
      href: "/dashboard/inquiries",
      category: "inquiries",
      priority: "normal",
      readAt: null as Date | null,
    },
    {
      dedupeKey: `demo:${tenantId}:billing.invoice_ready`,
      eventType: "billing.invoice_ready",
      title: "Plan invoice ready",
      body: "Your next plan invoice is ready to review.",
      href: "/dashboard/settings?tab=billing",
      category: "billing",
      priority: "high",
      readAt: null as Date | null,
    },
  ];

  for (const row of inboxRows) {
    const [notification] = await db
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
        category: row.category,
        priority: row.priority,
        tenantId,
        title: row.title,
      })
      .onConflictDoUpdate({
        target: [inAppNotifications.tenantId, inAppNotifications.dedupeKey],
        set: {
          body: row.body,
          category: row.category,
          eventType: row.eventType,
          href: row.href,
          priority: row.priority,
          title: row.title,
        },
      })
      .returning({ id: inAppNotifications.id });
    if (notification) {
      await db
        .insert(inAppNotificationReceipts)
        .values({ notificationId: notification.id, readAt: row.readAt, tenantId, userId })
        .onConflictDoUpdate({
          target: [inAppNotificationReceipts.notificationId, inAppNotificationReceipts.userId],
          set: { archivedAt: null, readAt: row.readAt },
        });
    }
  }

  void commerce;

  return {
    customRoles: tenantContext?.organizationId ? 1 : 0,
    deliveryZones: 7,
    inquiries: inquiryRows.length,
    invoices: subscription ? 2 : 0,
    notificationPrefs: 1,
    inbox: inboxRows.length,
    paymentOnboarding: shop.paymentOnboarding.status,
  };
}

export function demoAddress(customer: DemoShopDefinition["customers"][number]) {
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

export async function seedMetrics(
  db: PlatformDb,
  tenantId: string,
  productCount: number,
  customerCount: number,
) {
  // Replace prior demo metrics so re-seeds refresh the chart series.
  await db.delete(dailyMetrics).where(eq(dailyMetrics.tenantId, tenantId));

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
    metricRow(tenantId, latest, "overview.products", productCount),
    metricRow(tenantId, latest, "overview.customers.unique", customerCount),
    metricRow(
      tenantId,
      latest,
      "overview.customers.repeat",
      Math.max(2, Math.floor(customerCount * 0.4)),
    ),
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
    await db.insert(dailyMetrics).values(rows);
  }

  await db
    .insert(metricRollupCheckpoints)
    .values({
      lastSuccessfulAt: now,
      metadata: { demoSeed: DEMO_SEED_MARKER, rowCount: rows.length },
      rollupKey: COMMERCE_ROLLUP_KEY,
      rollupVersion: COMMERCE_ROLLUP_VERSION,
      tenantId,
      timezone: DEFAULT_REPORTING_TIMEZONE,
      updatedAt: now,
      watermark: now,
    })
    .onConflictDoUpdate({
      target: [
        metricRollupCheckpoints.tenantId,
        metricRollupCheckpoints.rollupKey,
        metricRollupCheckpoints.rollupVersion,
      ],
      set: {
        lastSuccessfulAt: now,
        metadata: { demoSeed: DEMO_SEED_MARKER, rowCount: rows.length },
        timezone: DEFAULT_REPORTING_TIMEZONE,
        updatedAt: now,
        watermark: now,
      },
    });
}

export async function seedAnalyticsEvents(
  db: PlatformDb,
  tenantId: string,
  shop: DemoShopDefinition,
) {
  await db.delete(analyticsEvents).where(eq(analyticsEvents.tenantId, tenantId));

  const now = new Date();
  const events: Array<typeof analyticsEvents.$inferInsert> = [];
  const referrers = ["direct", "google.com", "instagram.com", "t.me", "facebook.com"];
  const devices = ["mobile", "mobile", "mobile", "desktop", "tablet"];
  const areas = ["Bole", "Kazanchis", "CMC", "Megenagna", "Piassa", "Sarbet"];
  const products = shop.products.map((product) => product.handle);
  let sequence = 0;

  // Model sessions instead of inserting equal event totals. Every session opens
  // the shop; progressively smaller cohorts browse, search, cart, and checkout.
  for (let session = 0; session < 180; session += 1) {
    const daysAgo = Math.min(59, Math.floor((session * 0.34) % 60));
    const occurredAt = addDays(now, -daysAgo);
    occurredAt.setUTCHours(8 + (session % 13), (session * 11) % 60, session % 60, 0);
    const sessionIdHash = session.toString(16).padStart(64, "0");
    const productHandle = products[session % Math.max(products.length, 1)] ?? null;
    const baseProperties = {
      area: areas[session % areas.length],
      demo_seed: DEMO_SEED_MARKER,
      device: devices[session % devices.length],
      handle: shop.tenant.handle,
      referrer: referrers[session % referrers.length],
    };
    const push = (
      eventType: string,
      offsetMinutes: number,
      properties: Record<string, unknown> = {},
      subjectId: string | null = null,
      subjectType: string | null = null,
    ) => {
      const eventTime = new Date(occurredAt.getTime() + offsetMinutes * 60_000);
      events.push({
        eventType,
        idempotencyKey: `demo:${shop.tenant.handle}:${session}:${sequence++}`,
        occurredAt: eventTime,
        properties: { ...baseProperties, ...properties },
        sessionIdHash,
        source: "storefront",
        subjectId,
        subjectType,
        tenantId,
      });
    };

    push("storefront.page_viewed", 0, { path: "/" });
    if (session % 10 < 8 && productHandle) {
      push(
        "storefront.product_viewed",
        2,
        { path: `/products/${productHandle}` },
        productHandle,
        "product",
      );
    }
    if (session % 5 === 0) {
      push("storefront.search_submitted", 1, {
        query: shop.tenant.handle === "addistech" ? "wireless" : "new season",
      });
    }
    if (session % 10 < 4 && productHandle) {
      push("storefront.add_to_cart_clicked", 4, {}, productHandle, "product");
    }
    if (session % 10 < 2) push("storefront.checkout_started", 7);
    if (session % 20 === 0) push("storefront.contact_clicked", 3);
  }

  await db.insert(analyticsEvents).values(events);
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

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
