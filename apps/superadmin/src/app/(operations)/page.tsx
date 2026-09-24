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
import { OperationsDataState } from "@/components/operations-data-state";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Operations overview"
        description="Merchant issues that need a decision or follow-up."
        actions={
          <Button asChild variant="outline">
            <Link href="/merchants">
              Browse merchants <ArrowRight aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

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
            <OperationsListShell
              toolbar={<h2 className="font-semibold">Needs attention</h2>}
              status={
                <Badge variant={result.data.summary.attentionItems ? "destructive" : "secondary"}>
                  {result.data.summary.attentionItems}
                </Badge>
              }
            >
              {result.data.attention.length ? (
                <div className="divide-y">
                  {result.data.attention.map((item) => (
                    <Link
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/35"
                      href={`/tenants/${item.merchant.id}${item.kind === "billing_due" || item.kind === "payment_review" ? "?view=commerce" : ""}`}
                      key={item.id}
                    >
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
                <OperationsDataState
                  className="min-h-36 rounded-none border-0"
                  icon={ShieldCheck}
                  title="Nothing needs attention"
                  description="No current items in the tracked queues."
                />
              )}
            </OperationsListShell>

            <OperationsListShell
              toolbar={<h2 className="font-semibold">Recent operator activity</h2>}
            >
              {result.data.recentActivity.length ? (
                <div className="divide-y">
                  {result.data.recentActivity.map((activity) => (
                    <div className="flex gap-3 px-5 py-4" key={activity.id}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{formatAuditAction(activity.action)}</p>
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
                <OperationsDataState
                  className="min-h-36 rounded-none border-0"
                  icon={Clock3}
                  title="No operator activity yet"
                  description="Recorded changes will appear here."
                />
              )}
            </OperationsListShell>
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
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={emphasis ? "text-destructive" : "text-primary"}>
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
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
