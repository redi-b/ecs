import {
  insightsDemandQuerySchema,
  type InsightsDemandQuery,
  type InsightsDemandReport,
} from "@ecs/contracts";
import { reportingDay, reportingDays } from "./reporting-calendar.js";
import { sourceCoverage, type SalesSource } from "./insights-sales.js";

export type DemandRow = InsightsDemandReport["rows"][number];
export type ReadProductDemand = (input: {
  tenantId: string;
  query: InsightsDemandQuery;
}) => Promise<{
  checkpoint: SalesSource["checkpoint"];
  count: number;
  tracking: InsightsDemandReport["tracking"];
  rows: DemandRow[];
}>;

export function createInsightsDemandService(read: ReadProductDemand, now = () => new Date()) {
  return async (input: { tenantId: string; query: unknown }) => {
    const parsed = insightsDemandQuerySchema.safeParse(input.query);
    const generatedAt = now();
    if (
      !parsed.success ||
      parsed.data.from < "1970-01-01" ||
      parsed.data.from > parsed.data.to ||
      parsed.data.to >= reportingDay(generatedAt) ||
      reportingDays(parsed.data.from, parsed.data.to) > 366
    ) {
      return { ok: false as const, status: 400 as const, error: "insights_range_invalid" };
    }
    const query = parsed.data;
    const source = await read({ tenantId: input.tenantId, query });
    const coverage = sourceCoverage(source.checkpoint);
    const metadata = source.checkpoint?.metadata as Record<string, unknown> | undefined;
    const salesAvailable = !!(
      coverage &&
      query.from >= coverage.from &&
      query.to <= coverage.to &&
      metadata?.productReportVersion === 1 &&
      metadata.missingItemOrders === 0 &&
      metadata.unassignedProductUnits === 0
    );
    const report: InsightsDemandReport = {
      tenantId: input.tenantId,
      generatedAt: generatedAt.toISOString(),
      range: { from: query.from, to: query.to },
      salesAvailable,
      count: source.count,
      page: query.page,
      pageSize: query.pageSize,
      tracking: source.tracking,
      rows: source.rows.map((row) => ({
        ...row,
        units: salesAvailable && row.productId ? row.units : null,
        paidUnits: salesAvailable && row.productId ? row.paidUnits : null,
      })),
    };
    return { ok: true as const, report };
  };
}
