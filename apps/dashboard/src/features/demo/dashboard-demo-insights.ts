import type {
  InsightsDemandReport,
  InsightsProductsReport,
  InsightsSalesReport,
  InsightsStorefrontReport,
} from "@ecs/contracts";

const tenantId = "demo";
const generatedAt = "2026-09-13T18:00:00.000Z";
const range = { from: "2026-08-15", to: "2026-09-13" };
const previousRange = { from: "2026-07-16", to: "2026-08-14" };
const dailyOrders = [2, 3, 1, 5, 4, 2, 6, 3, 4, 7, 5, 3, 8, 4, 6, 9, 5, 7, 4, 8, 6, 10, 7, 5, 9, 8, 11, 7, 10, 12];

function day(from: string, offset: number) {
  return new Date(Date.parse(`${from}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export const demoSalesReport: InsightsSalesReport = {
  tenantId,
  generatedAt,
  timezone: "Africa/Addis_Ababa",
  currencyCode: "ETB",
  range,
  previousRange,
  quality: { status: "fresh", updatedAt: generatedAt, coverage: range },
  totals: {
    orders: dailyOrders.reduce((sum, value) => sum + value, 0),
    paidOrderValue: dailyOrders.reduce((sum, value, index) => sum + value * (1_040 + index * 19), 0),
  },
  previousTotals: { orders: 151, paidOrderValue: 184_650 },
  series: dailyOrders.map((orders, index) => ({
    date: day(range.from, index),
    orders,
    paidOrderValue: orders * (1_040 + index * 19),
    previousDate: day(previousRange.from, index),
    previousOrders: Math.max(0, orders - (index % 4 === 0 ? 2 : 1)),
    previousPaidOrderValue: Math.max(0, orders - 1) * (990 + index * 14),
  })),
};

export const demoProductsReport: InsightsProductsReport = {
  tenantId,
  range,
  previousRange,
  available: true,
  comparisonAvailable: true,
  count: 8,
  page: 1,
  pageSize: 20,
  rows: [
    product("woven-market-tote", "Woven Market Tote", 48, 39, 34),
    product("ceramic-coffee-set", "Ceramic Coffee Set", 37, 31, 28),
    product("hand-poured-candle", "Hand-poured Candle", 35, 30, 22),
    product("linen-table-runner", "Linen Table Runner", 27, 20, 31),
    product("leather-card-holder", "Leather Card Holder", 24, 22, 17),
    product("woven-cushion-cover", "Woven Cushion Cover", 19, 16, 13),
    product("stoneware-serving-bowl", "Stoneware Serving Bowl", 14, 12, 16),
    product("cotton-throw", "Cotton Throw", 11, 9, 8),
  ],
};

function product(id: string, title: string, units: number, paidUnits: number, previousUnits: number) {
  return {
    productId: id,
    title,
    thumbnail: null,
    units,
    paidUnits,
    previousUnits,
    change: units - previousUnits,
  };
}

export const demoDemandReport: InsightsDemandReport = {
  tenantId,
  generatedAt,
  range,
  salesAvailable: true,
  count: 8,
  page: 1,
  pageSize: 20,
  tracking: { recordedEvents: 1_842, unlinkedEvents: 0, eventsWithoutSession: 0 },
  rows: demoProductsReport.rows.map((row, index) => ({
    key: `product:${row.productId}`,
    productId: row.productId,
    identity: "product",
    title: row.title,
    thumbnail: row.thumbnail,
    views: [286, 241, 218, 193, 164, 142, 119, 96][index]!,
    cartSessions: [71, 56, 61, 38, 35, 29, 21, 17][index]!,
    units: row.units,
    paidUnits: row.paidUnits,
  })),
};

export const demoStorefrontReport: InsightsStorefrontReport = {
  tenantId,
  generatedAt,
  range,
  previousRange,
  stage: "pages",
  recordedEvents: 2_736,
  eventsWithoutSession: 0,
  count: 7,
  page: 1,
  pageSize: 20,
  stages: [
    { key: "pages", sessions: 1_284, previousSessions: 1_062 },
    { key: "products", sessions: 741, previousSessions: 604 },
    { key: "cart", sessions: 214, previousSessions: 181 },
    { key: "checkout", sessions: 103, previousSessions: 87 },
    { key: "search", sessions: 168, previousSessions: 142 },
  ],
  rows: [
    { path: "/", sessions: 612 },
    { path: "/shop", sessions: 371 },
    { path: "/collections/home", sessions: 126 },
    { path: "/collections/gifts", sessions: 84 },
    { path: "/about", sessions: 42 },
    { path: "/contact", sessions: 31 },
    { path: "/request-item", sessions: 18 },
  ],
  traffic: {
    status: "available",
    dimension: "referrer",
    page: 1,
    pageSize: 20,
    count: 5,
    limited: false,
    limit: 500,
    summary: { visitors: 1_031, visits: 1_284, pageViews: 2_418 },
    rows: [
      { key: "", visitors: 512 },
      { key: "instagram.com", visitors: 238 },
      { key: "google.com", visitors: 147 },
      { key: "t.me", visitors: 89 },
      { key: "facebook.com", visitors: 45 },
    ],
  },
};

export function createDemoInsightsReports(params: Record<string, string | undefined>) {
  const selectedRange = safeRange(params.from, params.to);
  const days = Math.round(
    (Date.parse(`${selectedRange.to}T00:00:00Z`) -
      Date.parse(`${selectedRange.from}T00:00:00Z`)) /
      86_400_000,
  ) + 1;
  const comparison = params.comparison !== "none";
  const selectedPrevious = comparison
    ? {
        from: day(selectedRange.from, -days),
        to: day(selectedRange.from, -1),
      }
    : null;
  const orders = Array.from({ length: days }, (_, index) => 2 + ((index * 7 + 3) % 11));
  const series = orders.map((count, index) => ({
    date: day(selectedRange.from, index),
    orders: count,
    paidOrderValue: count * (1_040 + (index % 30) * 19),
    previousDate: selectedPrevious ? day(selectedPrevious.from, index) : null,
    previousOrders: selectedPrevious ? Math.max(0, count - (index % 4 === 0 ? 2 : 1)) : null,
    previousPaidOrderValue: selectedPrevious
      ? Math.max(0, count - 1) * (990 + (index % 30) * 14)
      : null,
  }));
  const sales: InsightsSalesReport = {
    ...demoSalesReport,
    range: selectedRange,
    previousRange: selectedPrevious,
    quality: { ...demoSalesReport.quality, coverage: selectedRange },
    totals: {
      orders: series.reduce((sum, row) => sum + row.orders, 0),
      paidOrderValue: series.reduce((sum, row) => sum + row.paidOrderValue, 0),
    },
    previousTotals: selectedPrevious
      ? {
          orders: series.reduce((sum, row) => sum + (row.previousOrders ?? 0), 0),
          paidOrderValue: series.reduce(
            (sum, row) => sum + (row.previousPaidOrderValue ?? 0),
            0,
          ),
        }
      : null,
    series,
  };
  const productSearch = (params.productSearch ?? "").trim().toLocaleLowerCase();
  const productRows = demoProductsReport.rows
    .filter((row) => !productSearch || row.title?.toLocaleLowerCase().includes(productSearch))
    .sort((a, b) =>
      params.productSort === "change"
        ? Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)
        : b.units - a.units,
    );
  const products: InsightsProductsReport = {
    ...demoProductsReport,
    range: selectedRange,
    previousRange: selectedPrevious,
    comparisonAvailable: comparison,
    count: productRows.length,
    rows: productRows,
  };
  const demandSearch = (params.demandSearch ?? "").trim().toLocaleLowerCase();
  const demandRows = demoDemandReport.rows
    .filter((row) => !demandSearch || row.title?.toLocaleLowerCase().includes(demandSearch))
    .sort((a, b) => {
      const key = params.demandSort === "units" ? "units" : params.demandSort === "cart" ? "cartSessions" : "views";
      return (b[key] ?? -1) - (a[key] ?? -1);
    });
  const demand: InsightsDemandReport = {
    ...demoDemandReport,
    range: selectedRange,
    count: demandRows.length,
    rows: demandRows,
  };
  const stage = isStage(params.stage) ? params.stage : "pages";
  const pathRows = demoPaths[stage].filter((row) =>
    row.path.toLocaleLowerCase().includes((params.pathSearch ?? "").trim().toLocaleLowerCase()),
  );
  const dimension = isDimension(params.trafficDimension) ? params.trafficDimension : "referrer";
  const trafficRows = demoTraffic[dimension].filter((row) =>
    row.key.toLocaleLowerCase().includes((params.trafficSearch ?? "").trim().toLocaleLowerCase()),
  );
  const storefront: InsightsStorefrontReport = {
    ...demoStorefrontReport,
    range: selectedRange,
    previousRange: selectedPrevious,
    stage,
    count: pathRows.length,
    rows: pathRows,
    traffic: {
      ...demoStorefrontReport.traffic!,
      dimension,
      count: trafficRows.length,
      rows: trafficRows,
    },
  };
  return { demand, products, sales, storefront };
}

const demoPaths: Record<InsightsStorefrontReport["stage"], InsightsStorefrontReport["rows"]> = {
  pages: demoStorefrontReport.rows,
  products: [
    { path: "/products/woven-market-tote", sessions: 214 },
    { path: "/products/ceramic-coffee-set", sessions: 176 },
    { path: "/products/hand-poured-candle", sessions: 149 },
    { path: "/products/linen-table-runner", sessions: 118 },
  ],
  cart: [{ path: "/cart", sessions: 214 }],
  checkout: [{ path: "/checkout", sessions: 103 }],
  search: [{ path: "/shop", sessions: 168 }],
};

const demoTraffic = {
  referrer: demoStorefrontReport.traffic!.rows,
  path: demoStorefrontReport.rows.map((row) => ({ key: row.path, visitors: row.sessions })),
  device: [
    { key: "mobile", visitors: 724 },
    { key: "desktop", visitors: 269 },
    { key: "tablet", visitors: 38 },
  ],
  country: [
    { key: "ET", visitors: 914 },
    { key: "US", visitors: 43 },
    { key: "GB", visitors: 29 },
    { key: "KE", visitors: 18 },
  ],
} satisfies Record<"referrer" | "path" | "device" | "country", Array<{ key: string; visitors: number }>>;

function safeRange(from: string | undefined, to: string | undefined) {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return range;
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 && days < 366 ? { from, to } : range;
}

function isStage(value: string | undefined): value is InsightsStorefrontReport["stage"] {
  return ["pages", "products", "cart", "checkout", "search"].includes(value ?? "");
}

function isDimension(value: string | undefined): value is "referrer" | "path" | "device" | "country" {
  return ["referrer", "path", "device", "country"].includes(value ?? "");
}
