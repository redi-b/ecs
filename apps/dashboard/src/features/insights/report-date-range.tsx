"use client";

import type { InsightsSalesReport } from "@ecs/contracts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useI18n } from "@/i18n/provider";
import { defaultSalesRange, shiftSalesDay } from "./sales-report-model";

export function ReportDateRange({
  report,
  pending,
  onChange,
}: {
  report: Pick<InsightsSalesReport, "generatedAt" | "range"> & {
    quality?: Pick<InsightsSalesReport["quality"], "coverage">;
  };
  pending: boolean;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const { t, locale } = useI18n();
  const yesterday = defaultSalesRange(new Date(report.generatedAt)).to;
  const choices = [7, 30, 90].map((days) => ({
    value: String(days),
    label: t("insights.range.lastDays", { days }),
    from: shiftSalesDay(yesterday, 1 - days),
    to: yesterday,
  }));
  const coverage = report.quality?.coverage;
  if (coverage)
    choices.push({ value: "available", label: t("insights.range.available"), ...coverage });
  const selected = choices.find(
    (choice) => choice.from === report.range.from && choice.to === report.range.to,
  );
  return (
    <DateRangePicker
      className="sm:w-[19rem]"
      disabled={pending}
      max={yesterday}
      min="1970-01-01"
      showBounds={false}
      maxDays={366}
      value={{ start: report.range.from, end: report.range.to }}
      formatDate={(date) =>
        new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(date)
      }
      onChange={({ start, end }) => onChange({ from: start, to: end })}
      labels={{
        apply: t("insights.range.apply"),
        available: t("insights.range.allowed"),
        cancel: t("common.cancel"),
        chooseStart: t("insights.range.chooseStart"),
        chooseEnd: t("insights.range.chooseEnd"),
        clear: t("insights.range.clear"),
        start: t("insights.salesWorkspace.from"),
        end: t("insights.salesWorkspace.to"),
        notSet: t("insights.range.notSet"),
        invalidRange: t("insights.salesWorkspace.invalidRange"),
      }}
      presets={{
        label: t("insights.period.label"),
        value: selected?.value ?? "custom",
        options: [...choices, { value: "custom", label: t("insights.range.custom") }],
        onChange: (value) => {
          const choice = choices.find((item) => item.value === value);
          if (choice) onChange({ from: choice.from, to: choice.to });
          else return false;
        },
      }}
    />
  );
}
