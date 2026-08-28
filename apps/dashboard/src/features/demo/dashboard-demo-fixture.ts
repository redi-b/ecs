import { type MerchantDashboardSummary, merchantDashboardSummarySchema } from "@ecs/contracts";

const dailyTrading = [
  ["2026-07-28", 4_860, 3, 2],
  ["2026-07-31", 7_240, 4, 3],
  ["2026-08-03", 3_950, 2, 2],
  ["2026-08-06", 9_780, 6, 5],
  ["2026-08-09", 6_420, 4, 3],
  ["2026-08-12", 12_350, 7, 6],
  ["2026-08-15", 8_690, 5, 4],
  ["2026-08-18", 15_280, 8, 7],
  ["2026-08-21", 10_460, 6, 5],
  ["2026-08-24", 17_900, 9, 8],
] as const;

const fixture = {
  tenant: {
    id: "demo-tenant",
    name: "Aster Market",
    handle: "aster-market",
    status: "active",
  },
  domain: {
    id: "demo-domain",
    hostname: "aster-market.ecs.et",
  },
  actor: {
    id: "demo-merchant",
    email: "merchant@example.com",
    name: "Meron",
    role: "owner",
  },
  commerce: {
    hasPublishableKey: true,
    hasSalesChannel: true,
    hasStore: true,
  },
  storefront: {
    isPublished: true,
    hasUnpublishedChanges: false,
    publishedRevisionId: "demo-revision",
    publishedTemplateKey: "luvia@1",
    savedTemplateKeys: ["luvia@1"],
    templateId: "demo-template",
    templateKey: "luvia@1",
    templateVersion: 1,
  },
  operations: {
    range: {
      label: "Last 30 days",
      days: 30,
      sampledOrderCount: 54,
    },
    quality: {
      lastSuccessfulAt: "2026-08-26T08:30:00.000Z",
      rollupVersion: 1,
      status: "fresh",
      timezone: "Africa/Addis_Ababa",
      watermark: "2026-08-26T08:30:00.000Z",
    },
    totals: {
      revenue: 96_930,
      orders: 54,
      products: 38,
      customers: 41,
      currencyCode: "ETB",
    },
    attention: {
      unfulfilledOrders: 6,
      unpaidOrders: 3,
      draftProducts: 4,
    },
    customers: {
      unique: 41,
      repeat: 13,
    },
    breakdowns: {
      orderStatus: [
        { label: "Completed", count: 37 },
        { label: "Pending", count: 11 },
        { label: "Cancelled", count: 6 },
      ],
      paymentStatus: [
        { label: "Paid", count: 43 },
        { label: "Awaiting payment", count: 11 },
      ],
      fulfillmentStatus: [
        { label: "Delivered", count: 34 },
        { label: "Processing", count: 14 },
        { label: "Not fulfilled", count: 6 },
      ],
    },
    series: dailyTrading.map(([date, revenue, orders, customers]) => ({
      date,
      revenue,
      orders,
      customers,
    })),
    recentOrders: [
      {
        id: "order_01DEMO1048",
        displayId: 1048,
        email: "selam@example.com",
        total: 2_850,
        currencyCode: "ETB",
        paymentStatus: "captured",
        fulfillmentStatus: "fulfilled",
        createdAt: "2026-08-26T08:12:00.000Z",
      },
      {
        id: "order_01DEMO1047",
        displayId: 1047,
        email: "hana@example.com",
        total: 1_940,
        currencyCode: "ETB",
        paymentStatus: "captured",
        fulfillmentStatus: "not_fulfilled",
        createdAt: "2026-08-26T07:46:00.000Z",
      },
      {
        id: "order_01DEMO1046",
        displayId: 1046,
        email: "betelhem@example.com",
        total: 3_420,
        currencyCode: "ETB",
        paymentStatus: "awaiting",
        fulfillmentStatus: "not_fulfilled",
        createdAt: "2026-08-25T16:22:00.000Z",
      },
    ],
    unavailable: [],
  },
  analytics: {
    range: {
      days: 30,
      from: "2026-07-28T00:00:00.000Z",
      to: "2026-08-26T23:59:59.999Z",
    },
    totals: {
      events: 2_641,
      storefrontEvents: 2_338,
      platformEvents: 188,
      medusaEvents: 115,
    },
    topEvents: [
      { eventType: "storefront.visit", count: 1_204 },
      { eventType: "product.view", count: 746 },
      { eventType: "cart.item_added", count: 238 },
    ],
    funnel: [
      { key: "storefront_visits", count: 1_204 },
      { key: "product_views", count: 746 },
      { key: "add_to_cart", count: 238 },
      { key: "checkout_started", count: 91 },
      { key: "orders_created", count: 54 },
    ],
    storefront: {
      addToCartVisits: 238,
      checkoutVisits: 91,
      contactVisits: 64,
      pageViews: 3_842,
      productViewVisits: 746,
      searchVisits: 128,
      visits: 1_204,
    },
    products: [
      { productId: "woven-market-tote", viewVisits: 214, addToCartVisits: 81 },
      { productId: "ceramic-coffee-set", viewVisits: 176, addToCartVisits: 54 },
      { productId: "linen-table-runner", viewVisits: 138, addToCartVisits: 36 },
    ],
    coverage: {
      lastEventAt: "2026-08-26T08:28:00.000Z",
      status: "observed",
    },
    unavailable: false,
  },
} satisfies MerchantDashboardSummary;

export const dashboardDemoFixture = merchantDashboardSummarySchema.parse(fixture);
