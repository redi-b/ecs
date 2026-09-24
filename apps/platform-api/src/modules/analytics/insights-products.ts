import {
  insightsProductsQuerySchema,
  type InsightsProductsQuery,
  type InsightsProductsReport,
} from "@ecs/contracts";
import { comparisonRange, sourceCoverage, type SalesSource } from "./insights-sales.js";
import { reportingDay, reportingDays } from "./reporting-calendar.js";

export type ProductContribution = {
  productId: string;
  variantId?: string | null;
  variantTitle?: string | null;
  title: string | null;
  thumbnail: string | null;
  units: number;
  paidUnits: number;
  previousUnits: number;
};
export type ReadProductContributions = (input: {
  tenantId: string;
  query: InsightsProductsQuery;
  previousRange: { from: string; to: string } | null;
}) => Promise<{
  checkpoint: SalesSource["checkpoint"];
  count: number;
  rows: ProductContribution[];
}>;

export function createInsightsProductsService(
  read: ReadProductContributions,
  now: () => Date = () => new Date(),
) {
  return async (input: { tenantId: string; query: unknown }) => {
    const parsed = insightsProductsQuerySchema.safeParse(input.query);
    if (
      !parsed.success ||
      parsed.data.from < "1970-01-01" ||
      parsed.data.from > parsed.data.to ||
      parsed.data.to >= reportingDay(now()) ||
      reportingDays(parsed.data.from, parsed.data.to) > 366
    )
      return { ok: false as const, error: "insights_range_invalid", status: 400 as const };
    const query = parsed.data;
    const previousRange = comparisonRange(query);
    const source = await read({ tenantId: input.tenantId, query, previousRange });
    const coverage = sourceCoverage(source.checkpoint);
    const metadata = source.checkpoint?.metadata as Record<string, unknown> | undefined;
    const productCoverage =
      metadata?.productReportVersion === 1 &&
      metadata.missingItemOrders === 0 &&
      metadata.unassignedProductUnits === 0;
    const includes = (range: { from: string; to: string } | null) =>
      !!(
        range &&
        coverage &&
        productCoverage &&
        range.from >= coverage.from &&
        range.to <= coverage.to
      );
    const available = includes(query);
    const comparisonAvailable = includes(previousRange);
    const report: InsightsProductsReport = {
      tenantId: input.tenantId,
      range: { from: query.from, to: query.to },
      previousRange,
      available,
      comparisonAvailable,
      count: available ? source.count : 0,
      page: query.page,
      pageSize: query.pageSize,
      rows: available
        ? source.rows.map((row) => ({
            ...row,
            previousUnits: comparisonAvailable ? row.previousUnits : null,
            change: comparisonAvailable ? row.units - row.previousUnits : null,
          }))
        : [],
    };
    return { ok: true as const, report };
  };
}
