"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const reports = [
  ["overview", "/admin/insights"],
  ["sales", "/admin/insights/sales"],
  ["storefront", "/admin/insights/storefront"],
  ["products", "/admin/insights/products"],
  ["customers", "/admin/insights/customers"],
] as const;

export function InsightsReportNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  return (
    <nav aria-label={t("insights.reports.label")} className="overflow-x-auto border-b">
      <div className="flex min-w-max gap-1">
        {reports.map(([id, path]) => {
          const active = pathname === path;
          const href = tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative min-h-10 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active &&
                  "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              )}
              href={href}
              key={id}
            >
              {t(`insights.reports.${id}`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
