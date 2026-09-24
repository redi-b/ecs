"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ExportDownloadButton } from "@/components/app/export-download-button";
import { useI18n } from "@/i18n/provider";

export function ReportExportLink({
  report,
  range,
  disabled = false,
}: {
  report: "products" | "demand" | "storefront-paths" | "traffic";
  range: { from: string; to: string };
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const current = useSearchParams();
  if (pathname.startsWith("/demo/")) return null;
  const params = new URLSearchParams(current.toString());
  params.set("report", report);
  params.set("from", range.from);
  params.set("to", range.to);
  return (
    <ExportDownloadButton
      href={`/dashboard/insights/actions/export?${params}`}
      fallbackFilename={`${report}-${range.from}-${range.to}.csv`}
      label={t("insights.salesWorkspace.export")}
      pendingLabel={t("insights.salesWorkspace.exporting")}
      failedMessage={t("insights.salesWorkspace.exportFailed")}
      disabled={disabled}
      size="sm"
      variant="ghost"
    />
  );
}
