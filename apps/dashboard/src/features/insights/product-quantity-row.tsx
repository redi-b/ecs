"use client";

import type { InsightsProductsReport } from "@ecs/contracts";
import { ChevronDownIcon, PackageIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/i18n/provider";

/** One shared quantity scale per page. Never label order quantities as revenue. */
export function ProductQuantityRow({
  row,
  comparing,
  scale,
  onOpenVariants,
}: {
  row: InsightsProductsReport["rows"][number];
  comparing: boolean;
  scale: number;
  onOpenVariants?: ((productId: string) => void) | undefined;
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const title = row.title ?? t("insights.contributions.unnamed");
  const change =
    row.change === null
      ? t("insights.salesWorkspace.notAvailable")
      : row.change === 0
        ? t("insights.contributions.same")
        : t(row.change > 0 ? "insights.contributions.more" : "insights.contributions.fewer", {
            count: number(Math.abs(row.change)),
          });
  const paidShare = row.units > 0 ? Math.min(1, Math.max(0, row.paidUnits / row.units)) : 0;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_minmax(6rem,auto)_1rem]"
          aria-label={`${title}. ${t("insights.contributions.paymentDetails")}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
              {row.thumbnail && !failedImage ? (
                <img
                  src={row.thumbnail}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                  onError={() => setFailedImage(true)}
                />
              ) : (
                <PackageIcon className="size-5 text-muted-foreground" aria-hidden />
              )}
            </span>
            <span className="min-w-0 break-words text-sm font-medium">{title}</span>
          </span>
          <span className="col-span-2 flex min-w-0 flex-col gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <QuantityLane
              value={row.units}
              scale={scale}
              label={t("insights.contributions.thisPeriod")}
              number={number}
            />
            {comparing ? (
              <QuantityLane
                value={row.previousUnits}
                scale={scale}
                label={t("insights.contributions.previous")}
                number={number}
                previous
              />
            ) : null}
          </span>
          <span className="col-start-1 row-start-3 text-xs text-muted-foreground sm:col-start-3 sm:row-start-1 sm:text-right">
            {comparing ? change : t("insights.contributions.units")}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={`col-start-2 row-start-1 size-4 text-muted-foreground transition-transform motion-reduce:transition-none sm:col-start-4 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="motion-reduce:animate-none">
        <div className="flex flex-col gap-3 border-t border-border/50 bg-muted/20 px-4 py-4 sm:pl-[4.75rem]">
          <p className="text-xs font-medium">{t("insights.contributions.paymentDetails")}</p>
          <div className="flex max-w-lg flex-col gap-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="h-full bg-primary" style={{ width: `${paidShare * 100}%` }} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {t("insights.contributions.paidQuantity", { count: number(row.paidUnits) })}
              </span>
              <span>
                {t("insights.contributions.unpaidQuantity", {
                  count: number(Math.max(0, row.units - row.paidUnits)),
                })}
              </span>
            </div>
          </div>
          {onOpenVariants ? <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => onOpenVariants(row.productId)}
          >
            {t("insights.variants.open")}
          </Button> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QuantityLane({
  value,
  scale,
  label,
  number,
  previous = false,
}: {
  value: number | null;
  scale: number;
  label: string;
  number: (value: number) => string;
  previous?: boolean;
}) {
  const { t } = useI18n();
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
      <span className="sr-only">{label}: </span>
      <span className="relative flex h-3 items-center" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 border-t border-border/50" />
        {value !== null && value > 0 ? (
          <span
            className={`relative h-2 min-w-px rounded-full ${previous ? "border border-muted-foreground/60 bg-card" : "bg-primary"}`}
            style={{ width: `${Math.min(100, (value / scale) * 100)}%` }}
          />
        ) : null}
      </span>
      <span
        className={`text-right text-sm tabular-nums ${previous ? "text-muted-foreground" : "font-medium"}`}
      >
        {value === null ? t("insights.salesWorkspace.notAvailable") : number(value)}
      </span>
    </span>
  );
}
