import type { SuperadminOverview } from "@ecs/contracts";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Clock3,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatAuditAction } from "@/lib/format-audit-action";
import { getOpsAccess } from "@/lib/ops-access";
import { getSuperadminOverview } from "@/lib/platform-api/superadmin/overview";

const attentionCopy: Record<SuperadminOverview["attention"][number]["kind"], string> = {
  billing_due: "Invoice payment is overdue",
  merchant_suspended: "Merchant is suspended",
  payment_review: "Payment setup is ready for review",
  provisioning_failed: "Shop setup needs recovery",
};

export default async function OperationsOverviewPage() {
  const access = await getOpsAccess();
  if (access.ok && !access.permissions.includes("platform.overview.read")) {
    const firstAvailable = [
      ["tenants.read", "/merchants"],
      ["platform.work.read", "/work"],
      ["platform.health.read", "/health"],
      ["platform.audit.read", "/audit"],
      ["platform.operators.read", "/operators"],
    ].find(([permission]) => access.permissions.includes(permission));
    if (firstAvailable?.[1]) redirect(firstAvailable[1]);
  }
  const requestHeaders = await headers();
  const result = await getSuperadminOverview({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({
    ok: false as const,
    message: "operator_overview_unavailable",
    status: 503,
  }));

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Today</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Operations overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Start with merchant issues that need a decision or follow-up.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/merchants">
            Browse merchants <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </header>

      {!result.ok ? (
        <OperatorReadError
          resource="Operations overview"
          status={result.status}
          unavailableDescription="Merchant operations could not be summarized. The directory remains available."
        />
      ) : (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Platform summary"
          >
            <Metric icon={Building2} label="Merchants" value={result.data.summary.merchants} />
            <Metric
              icon={ShieldCheck}
              label="Active merchants"
              value={result.data.summary.activeMerchants}
            />
            <Metric
              icon={CircleAlert}
              label="Needs attention"
              value={result.data.summary.attentionItems}
              emphasis
            />
            <Metric
              icon={ExternalLink}
              label="Active support access"
              value={result.data.summary.activeSupportAccess}
            />
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Needs attention</CardTitle>
                    <CardDescription className="mt-1">
                      Current items across merchant operations.
                    </CardDescription>
                  </div>
                  <Badge variant={result.data.summary.attentionItems ? "destructive" : "secondary"}>
                    {result.data.summary.attentionItems}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {result.data.attention.length ? (
                  <div className="divide-y">
                    {result.data.attention.map((item) => (
                      <Link
                        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/35"
                        href={`/tenants/${item.merchant.id}${item.kind === "billing_due" || item.kind === "payment_review" ? "?view=commerce" : ""}`}
                        key={item.id}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                          <CircleAlert aria-hidden className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {attentionCopy[item.kind]}
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                            {item.merchant.name} · @{item.merchant.handle}
                          </span>
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {item.occurredAt ? formatRelative(item.occurredAt) : "Awaiting review"}
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty className="py-14">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ShieldCheck />
                      </EmptyMedia>
                      <EmptyTitle>Nothing needs attention</EmptyTitle>
                      <EmptyDescription>
                        There are no current operational items in the tracked queues.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Recent operator activity</CardTitle>
                <CardDescription className="mt-1">
                  Latest recorded platform changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {result.data.recentActivity.length ? (
                  <div className="divide-y">
                    {result.data.recentActivity.map((activity) => (
                      <div className="flex gap-3 px-5 py-4" key={activity.id}>
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Clock3 aria-hidden className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {formatAuditAction(activity.action)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {activity.actorName ?? "ECS operator"}
                            {activity.merchant ? ` · ${activity.merchant.name}` : ""}
                            {` · ${formatRelative(activity.createdAt)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty className="py-14">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Clock3 />
                      </EmptyMedia>
                      <EmptyTitle>No operator activity yet</EmptyTitle>
                      <EmptyDescription>
                        Sensitive platform changes will appear here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={emphasis ? "text-destructive" : "text-primary"}>
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function formatRelative(value: string) {
  const difference = Date.now() - Date.parse(value);
  if (!Number.isFinite(difference) || difference < 0) return "Just now";
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
