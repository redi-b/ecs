import { z } from "zod";

const daySchema = z.iso.date();
export const insightsSalesQuerySchema = z
  .object({
    from: daySchema,
    to: daySchema,
    comparison: z.enum(["previous", "none"]).default("previous"),
  })
  .strict();
export type InsightsSalesQuery = z.infer<typeof insightsSalesQuerySchema>;

const rangeSchema = z.object({ from: daySchema, to: daySchema });
const reportPageSizeSchema = z.coerce.number().int().min(20).max(500).default(20);
const totalsSchema = z.object({
  orders: z.number().int().nonnegative(),
  paidOrderValue: z.number().nonnegative(),
});

export const insightsSalesReportSchema = z.object({
  tenantId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  timezone: z.literal("Africa/Addis_Ababa"),
  currencyCode: z.literal("ETB"),
  range: rangeSchema,
  previousRange: rangeSchema.nullable(),
  quality: z.object({
    status: z.enum(["fresh", "stale", "missing"]),
    updatedAt: z.iso.datetime().nullable(),
    // Complete calendar days verified by the most recent successful source scan.
    coverage: rangeSchema.nullable(),
  }),
  totals: totalsSchema.nullable(),
  previousTotals: totalsSchema.nullable(),
  series: z.array(
    z.object({
      date: daySchema,
      orders: z.number().int().nonnegative().nullable(),
      paidOrderValue: z.number().nonnegative().nullable(),
      previousDate: daySchema.nullable(),
      previousOrders: z.number().int().nonnegative().nullable(),
      previousPaidOrderValue: z.number().nonnegative().nullable(),
    }),
  ),
});
export type InsightsSalesReport = z.infer<typeof insightsSalesReportSchema>;

export const insightsProductsQuerySchema = insightsSalesQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: reportPageSizeSchema,
  q: z.string().trim().max(120).default(""),
  sort: z.enum(["units", "change"]).default("units"),
  // Supplying a product selects its variant breakdown, within the same report scope.
  productId: z.string().trim().min(1).max(200).optional(),
});
export type InsightsProductsQuery = z.infer<typeof insightsProductsQuerySchema>;
export const insightsProductsReportSchema = z.object({
  tenantId: z.string(),
  range: rangeSchema,
  previousRange: rangeSchema.nullable(),
  available: z.boolean(),
  comparisonAvailable: z.boolean(),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(20).max(500),
  rows: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().nullable().optional(),
      variantTitle: z.string().nullable().optional(),
      title: z.string().nullable(),
      thumbnail: z.string().nullable(),
      units: z.number().nonnegative(),
      paidUnits: z.number().nonnegative(),
      previousUnits: z.number().nonnegative().nullable(),
      change: z.number().nullable(),
    }),
  ),
});
export type InsightsProductsReport = z.infer<typeof insightsProductsReportSchema>;

export const insightsDemandQuerySchema = insightsSalesQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: reportPageSizeSchema,
  q: z.string().trim().max(120).default(""),
  sort: z.enum(["views", "units", "cart"]).default("views"),
});
export type InsightsDemandQuery = z.infer<typeof insightsDemandQuerySchema>;
export const insightsDemandReportSchema = z.object({
  tenantId: z.string(),
  generatedAt: z.iso.datetime(),
  range: rangeSchema,
  salesAvailable: z.boolean(),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(20).max(500),
  tracking: z.object({
    recordedEvents: z.number().int().nonnegative(),
    unlinkedEvents: z.number().int().nonnegative(),
    eventsWithoutSession: z.number().int().nonnegative(),
  }),
  rows: z.array(
    z.object({
      key: z.string(),
      productId: z.string().nullable(),
      identity: z.enum(["product", "legacy_handle", "variant", "unknown"]),
      title: z.string().nullable(),
      thumbnail: z.string().nullable(),
      views: z.number().int().nonnegative(),
      cartSessions: z.number().int().nonnegative(),
      units: z.number().nonnegative().nullable(),
      paidUnits: z.number().nonnegative().nullable(),
    }),
  ),
});
export type InsightsDemandReport = z.infer<typeof insightsDemandReportSchema>;

export const insightsStorefrontQuerySchema = insightsSalesQuerySchema.extend({
  trafficDimension: z.enum(["referrer", "path", "device", "country"]).default("referrer"),
  trafficPage: z.coerce.number().int().min(1).max(10000).default(1),
  trafficPageSize: reportPageSizeSchema,
  trafficSearch: z.string().trim().max(120).default(""),
  stage: z.enum(["pages", "products", "cart", "checkout", "search"]).default("pages"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: reportPageSizeSchema,
  q: z.string().trim().max(120).default(""),
});
export type InsightsStorefrontQuery = z.infer<typeof insightsStorefrontQuerySchema>;
export const insightsTrafficSchema = z.object({
  status: z.enum(["available", "unavailable", "not_configured"]),
  dimension: insightsStorefrontQuerySchema.shape.trafficDimension,
  page: z.number().int().positive(),
  pageSize: z.number().int().min(20).max(500),
  count: z.number().int().nonnegative(),
  limited: z.boolean(),
  limit: z.literal(500),
  summary: z
    .object({
      visitors: z.number().int().nonnegative(),
      visits: z.number().int().nonnegative(),
      pageViews: z.number().int().nonnegative(),
    })
    .nullable(),
  rows: z.array(z.object({ key: z.string(), visitors: z.number().int().nonnegative() })),
});
export type InsightsTraffic = z.infer<typeof insightsTrafficSchema>;
export const insightsStorefrontReportSchema = z.object({
  traffic: insightsTrafficSchema.optional(),
  tenantId: z.string(),
  generatedAt: z.iso.datetime(),
  range: rangeSchema,
  previousRange: rangeSchema.nullable(),
  stage: insightsStorefrontQuerySchema.shape.stage,
  // Recorded sessions, not an ordered/cohort funnel or provider visitor totals.
  stages: z.array(
    z.object({
      key: insightsStorefrontQuerySchema.shape.stage,
      sessions: z.number().int().nonnegative(),
      previousSessions: z.number().int().nonnegative().nullable(),
    }),
  ),
  recordedEvents: z.number().int().nonnegative(),
  eventsWithoutSession: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(20).max(500),
  rows: z.array(z.object({ path: z.string(), sessions: z.number().int().nonnegative() })),
});
export type InsightsStorefrontReport = z.infer<typeof insightsStorefrontReportSchema>;
