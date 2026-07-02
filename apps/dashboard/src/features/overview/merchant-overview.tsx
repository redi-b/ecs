import type { MerchantDashboardSummary } from "@ecs/contracts";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MerchantOverviewProps = {
  summary: MerchantDashboardSummary;
};

const commerceItems = [
  { key: "hasStore", label: "Commerce store" },
  { key: "hasSalesChannel", label: "Sales channel" },
  { key: "hasPublishableKey", label: "Publishable key" },
] as const;

export function MerchantOverview({ summary }: MerchantOverviewProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Merchant readiness">
      <OverviewPanel title="Shop">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-card-foreground">{summary.tenant.name}</p>
            <p className="text-xs text-muted-foreground">/{summary.tenant.handle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="capitalize" variant="secondary">
              {summary.tenant.status}
            </Badge>
            <Badge variant="outline">{summary.domain.hostname}</Badge>
          </div>
        </div>
      </OverviewPanel>

      <OverviewPanel title="Commerce">
        <div className="flex flex-col gap-2">
          {commerceItems.map((item) => (
            <ReadinessRow key={item.key} label={item.label} ready={summary.commerce[item.key]} />
          ))}
        </div>
      </OverviewPanel>

      <OverviewPanel title="Storefront">
        <div className="flex flex-col gap-2">
          <ReadinessRow label="Published storefront" ready={summary.storefront.isPublished} />
          <DetailRow label="Template" value={summary.storefront.templateId ?? "Not selected"} />
          <DetailRow
            label="Version"
            value={
              summary.storefront.templateVersion
                ? `v${summary.storefront.templateVersion}`
                : "Not published"
            }
          />
        </div>
      </OverviewPanel>

      <OverviewPanel className="lg:col-span-3" title="Session">
        <div className="grid gap-3 md:grid-cols-3">
          <DetailRow label="Operator" value={summary.actor.name ?? summary.actor.email} />
          <DetailRow label="Email" value={summary.actor.email} />
          <DetailRow label="Role" value={summary.actor.role} />
        </div>
      </OverviewPanel>
    </section>
  );
}

function OverviewPanel({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ready ? "default" : "outline"}>{ready ? "Ready" : "Missing"}</Badge>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium capitalize text-card-foreground">{value}</span>
    </div>
  );
}
