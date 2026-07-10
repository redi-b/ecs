"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import type { ChartConfig } from "@/components/ui/chart";

export type MerchantOverviewProps = {
  summary: MerchantDashboardSummary;
};

export type ChartMetric = "revenue" | "orders" | "customers";

export const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  orders: {
    label: "Orders",
    color: "var(--chart-2)",
  },
  customers: {
    label: "Customers",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export const tradingChartConfig = {
  revenue: chartConfig.revenue,
  orderBars: {
    label: "Orders",
    color: "var(--chart-2)",
  },
  orderTrend: {
    label: "Order trend",
    color: "var(--chart-5)",
  },
  customers: chartConfig.customers,
} satisfies ChartConfig;

export const averageOrderConfig = {
  averageOrderValue: {
    label: "AOV",
    color: "var(--chart-1)",
  },
  orders: {
    label: "Orders",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export const demandRhythmConfig = {
  orders: {
    label: "Orders",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export const statusRingColors = [
  "var(--primary)",
  "oklch(0.72 0.17 195)",
  "oklch(0.7 0.18 292)",
  "oklch(0.74 0.18 28)",
  "oklch(0.73 0.16 145)",
] as const;

export const commerceItems = [
  { key: "hasStore", label: "Sales setup" },
  { key: "hasSalesChannel", label: "Sales channel" },
] as const;
