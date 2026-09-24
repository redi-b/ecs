import {
  insightsDemandQuerySchema,
  insightsProductsQuerySchema,
  insightsStorefrontQuerySchema,
} from "@ecs/contracts";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import {
  getInsightsDemand,
  getInsightsProducts,
  getInsightsStorefront,
} from "@/lib/insights-sales";

const encoder = new TextEncoder();
const pageSize = 20;

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const report = params.report;
  const requestHeaders = await headers();
  const context = {
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId: getSelectedTenantId(params),
  };

  if (report === "products") {
    const parsed = insightsProductsQuerySchema.safeParse({
      from: params.from,
      to: params.to,
      comparison: params.comparison ?? "previous",
      page: 1,
      pageSize: 500,
      q: params.productSearch ?? "",
      sort: params.productSort ?? "units",
      ...(params.selectedProduct ? { productId: params.selectedProduct } : {}),
    });
    if (!parsed.success) return invalidRequest();
    return streamCsv({
      filename: `product-sales-${parsed.data.from}-${parsed.data.to}.csv`,
      header: [
        "product_id",
        "variant_id",
        "product",
        "variant",
        "units",
        "paid_units",
        "previous_units",
        "change",
      ],
      read: async (page) => {
        const result = await getInsightsProducts({
          ...context,
          query: { ...parsed.data, page },
        });
        if (!result.ok) throw new ExportError(result.status);
        return {
          count: result.report.count,
          rows: result.report.rows.map((row) => [
            row.productId,
            row.variantId,
            row.title,
            row.variantTitle,
            row.units,
            row.paidUnits,
            row.previousUnits,
            row.change,
          ]),
        };
      },
    });
  }

  if (report === "demand") {
    const parsed = insightsDemandQuerySchema.safeParse({
      from: params.from,
      to: params.to,
      comparison: "none",
      page: 1,
      pageSize: 500,
      q: params.demandSearch ?? "",
      sort: params.demandSort ?? "views",
    });
    if (!parsed.success) return invalidRequest();
    return streamCsv({
      filename: `product-demand-${parsed.data.from}-${parsed.data.to}.csv`,
      header: [
        "identity",
        "product_id",
        "product",
        "viewing_sessions",
        "add_to_cart_sessions",
        "ordered_units",
        "paid_units",
      ],
      read: async (page) => {
        const result = await getInsightsDemand({
          ...context,
          query: { ...parsed.data, page },
        });
        if (!result.ok) throw new ExportError(result.status);
        return {
          count: result.report.count,
          rows: result.report.rows.map((row) => [
            row.identity,
            row.productId,
            row.title,
            row.views,
            row.cartSessions,
            row.units,
            row.paidUnits,
          ]),
        };
      },
    });
  }

  if (report === "storefront-paths" || report === "traffic") {
    const parsed = insightsStorefrontQuerySchema.safeParse({
      from: params.from,
      to: params.to,
      comparison: params.comparison ?? "previous",
      stage: params.stage ?? "pages",
      page: 1,
      pageSize: 500,
      q: params.pathSearch ?? "",
      trafficDimension: params.trafficDimension ?? "referrer",
      trafficPage: 1,
      trafficPageSize: 500,
      trafficSearch: params.trafficSearch ?? "",
    });
    if (!parsed.success) return invalidRequest();
    const traffic = report === "traffic";
    return streamCsv({
      filename: traffic
        ? `storefront-${parsed.data.trafficDimension}-${parsed.data.from}-${parsed.data.to}.csv`
        : `storefront-${parsed.data.stage}-${parsed.data.from}-${parsed.data.to}.csv`,
      header: traffic ? [parsed.data.trafficDimension, "visitors"] : ["path", "sessions"],
      read: async (page) => {
        const result = await getInsightsStorefront({
          ...context,
          query: {
            ...parsed.data,
            ...(traffic ? { trafficPage: page } : { page }),
          },
        });
        if (!result.ok) throw new ExportError(result.status);
        if (traffic) {
          if (result.report.traffic?.status !== "available") throw new ExportError(503);
          return {
            count: result.report.traffic.count,
            rows: result.report.traffic.rows.map((row) => [row.key, row.visitors]),
          };
        }
        return {
          count: result.report.count,
          rows: result.report.rows.map((row) => [row.path, row.sessions]),
        };
      },
    });
  }

  return invalidRequest();
}

class ExportError extends Error {
  constructor(readonly status: number) {
    super("Insights export failed");
  }
}

async function streamCsv(options: {
  filename: string;
  header: Array<string | number | null | undefined>;
  read: (page: number) => Promise<{
    count: number;
    rows: Array<Array<string | number | null | undefined>>;
  }>;
}) {
  let first;
  try {
    first = await options.read(1);
  } catch (error) {
    const status = error instanceof ExportError ? error.status : 503;
    return NextResponse.json({ error: "insights_export_unavailable" }, { status });
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFF${csvRow(options.header)}\r\n`));
        let page = 1;
        let written = 0;
        while (true) {
          const result = page === 1 ? first : await options.read(page);
          for (const row of result.rows) controller.enqueue(encoder.encode(`${csvRow(row)}\r\n`));
          written += result.rows.length;
          if (!result.rows.length || written >= result.count || result.rows.length < pageSize) break;
          page += 1;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${options.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  // Neutralize spreadsheet formulas without changing numeric cells.
  const safe = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function invalidRequest() {
  return NextResponse.json({ error: "invalid_insights_export" }, { status: 400 });
}
