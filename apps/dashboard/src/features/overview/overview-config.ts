"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import type { ChartConfig } from "@/components/ui/chart";

export type MerchantOverviewProps = {
  summary: MerchantDashboardSummary;
};

export type ChartMetric = "revenue" | "orders" | "customers";

/** Colors only — labels are localized at render time. */
export const chartColorConfig = {
  revenue: { color: "var(--chart-1)" },
  orders: { color: "var(--chart-2)" },
  customers: { color: "var(--chart-3)" },
  orderBars: { color: "var(--chart-2)" },
  orderTrend: { color: "var(--chart-5)" },
  averageOrderValue: { color: "var(--chart-1)" },
} as const;

export const statusRingColors = [
  "var(--primary)",
  "oklch(0.72 0.17 195)",
  "oklch(0.7 0.18 292)",
  "oklch(0.74 0.18 28)",
  "oklch(0.73 0.16 145)",
] as const;

export const commerceItemKeys = ["hasStore", "hasSalesChannel"] as const;
