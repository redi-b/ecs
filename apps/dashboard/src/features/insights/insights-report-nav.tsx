"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getDemoInsightsHref } from "@/features/demo/dashboard-demo-routes";
import { useI18n } from "@/i18n/provider";

const reports = [
  ["overview", "/admin/insights"],
  ["sales", "/admin/insights/sales"],
  ["products", "/admin/insights/products"],
  ["journey", "/admin/insights/journey"],
  ["traffic", "/admin/insights/traffic"],
  ["storefront", "/admin/insights/storefront"],
] as const;

export function InsightsReportNav({ demoMode = false }: { demoMode?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const availableReports = reports.filter(([id]) =>
    demoMode
      ? id === "sales" || id === "products" || id === "storefront"
      : id !== "overview" && id !== "journey" && id !== "traffic",
  );
  const current =
    availableReports.find(([id, path]) => {
      const resolvedPath = demoMode ? getDemoInsightsHref(id) : path;
      return (
        pathname === resolvedPath ||
        (demoMode && id === "sales" && pathname === "/demo/insights") ||
        (!demoMode && id === "sales" && pathname === "/admin/insights") ||
        (!demoMode &&
          id === "storefront" &&
          ["/admin/insights/journey", "/admin/insights/traffic"].includes(pathname))
      );
    })?.[0] ?? "sales";
  const [optimistic, setOptimistic] = useOptimistic(current);

  function navigate(id: (typeof availableReports)[number][0]) {
    if (id === current) return;
    const report = availableReports.find(([reportId]) => reportId === id);
    if (!report) return;
    const resolvedPath = demoMode ? getDemoInsightsHref(id) : report[1];
    const shared = new URLSearchParams();
    for (const key of ["tenantId", "from", "to", "comparison"]) {
      const value = searchParams.get(key);
      if (value && !demoMode) shared.set(key, value);
    }
    startTransition(() => {
      setOptimistic(id);
      router.push(shared.size ? `${resolvedPath}?${shared}` : resolvedPath, { scroll: false });
    });
  }

  return (
    <nav aria-label={t("insights.reports.label")} className="min-w-0 overflow-x-auto pb-0.5">
      <SegmentedControl
        active="primary"
        ariaLabel={t("insights.reports.label")}
        className="min-w-[20rem]"
        disabled={pending}
        fullWidth={false}
        onChange={navigate}
        options={availableReports.map(([id]) => ({
          id,
          label: t(`insights.reports.${id}`),
        }))}
        value={optimistic}
      />
    </nav>
  );
}
