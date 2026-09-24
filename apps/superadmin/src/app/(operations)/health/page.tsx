import {
  Activity,
  BellRing,
  Building2,
  CheckCircle2,
  type Clock3,
  Database,
  HardDrive,
  Images,
  Layers3,
  ServerCog,
  ShoppingBag,
  Store,
} from "lucide-react";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { RefreshPageButton } from "@/components/refresh-page-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobControlAction } from "@/features/superadmin/job-control-action";
import { getOpsAccess } from "@/lib/ops-access";
import { getJobOperations, getPlatformHealth } from "@/lib/platform-api/superadmin/console";

export default async function HealthPage() {
  const requestHeaders = await headers();
  const requestOptions = {
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  };
  const [result, jobResult, access] = await Promise.all([
    getPlatformHealth(requestOptions).catch(() => ({
      ok: false as const,
      message: "operator_health_unavailable",
      status: 503,
    })),
    getJobOperations(requestOptions).catch(() => ({
      ok: false as const,
      message: "job_operations_unavailable",
      status: 503,
    })),
    getOpsAccess(),
  ]);
  const canControlJobs = access.ok && access.permissions.includes("platform.work.retry");

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Health"
        description="Review failures, delays, and service availability."
        actions={<RefreshPageButton />}
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Health data"
          status={result.status}
          unavailableDescription="The platform could not read its operational state."
        />
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <span
              className={
                result.data.status === "clear" ? "text-success" : "text-warning-foreground"
              }
            >
              {result.data.status === "clear" ? (
                <CheckCircle2 aria-hidden className="size-5" />
              ) : (
                <Activity aria-hidden className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {result.data.status === "clear"
                  ? "Recorded operations are clear"
                  : "Recorded operations need attention"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Updated {formatDate(result.data.generatedAt)}
              </p>
            </div>
            <Badge variant={result.data.status === "clear" ? "success" : "warning"}>
              {result.data.status === "clear" ? "Clear" : "Attention"}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HealthCard
              icon={Layers3}
              title="Background work"
              description="Durable platform jobs waiting or running."
            >
              <Metric label="Queued" value={result.data.backgroundWork.queued} />
              <Metric label="Active" value={result.data.backgroundWork.active} />
              <Metric
                label="Failed in 24 hours"
                value={result.data.backgroundWork.failedLast24Hours}
                warn={result.data.backgroundWork.failedLast24Hours > 0}
              />
              <Metric
                label="Oldest queued"
                value={
                  result.data.backgroundWork.oldestQueuedAt
                    ? formatAge(result.data.backgroundWork.oldestQueuedAt)
                    : "None"
                }
              />
            </HealthCard>
            <HealthCard
              icon={BellRing}
              title="Notifications"
              description="Recorded merchant notification delivery state."
            >
              <Metric label="Pending" value={result.data.notifications.pending} />
              <Metric label="Retrying" value={result.data.notifications.retrying} />
              <Metric
                label="Failed in 24 hours"
                value={result.data.notifications.failedLast24Hours}
                warn={result.data.notifications.failedLast24Hours > 0}
              />
            </HealthCard>
            <HealthCard
              icon={Images}
              title="Media processing"
              description="Current image and file preparation state."
            >
              <Metric label="Ready" value={result.data.media.ready} />
              <Metric label="Waiting" value={result.data.media.pending} />
              <Metric label="Processing" value={result.data.media.processing} />
              <Metric
                label="Failed"
                value={result.data.media.failed}
                warn={result.data.media.failed > 0}
              />
            </HealthCard>
            <HealthCard
              icon={Building2}
              title="Merchants"
              description="Current merchant lifecycle states."
            >
              <Metric label="Active" value={result.data.merchants.active} />
              <Metric label="Draft" value={result.data.merchants.draft} />
              <Metric
                label="Suspended"
                value={result.data.merchants.suspended}
                warn={result.data.merchants.suspended > 0}
              />
              <Metric label="Cancelled" value={result.data.merchants.cancelled} />
            </HealthCard>
          </div>
          {jobResult.ok ? (
            <>
              <OperationsListShell
                status={`${jobResult.data.queues.reduce((total, queue) => total + queue.workers.length, 0)} workers online · Scheduler ${jobResult.data.scheduler ? "online" : "unavailable"}`}
                toolbar={
                  <div>
                    <h2 className="font-semibold">Job queues</h2>
                    <p className="text-sm text-muted-foreground">Live queue and worker state</p>
                  </div>
                }
              >
                <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
                  {jobResult.data.queues.map((queue) => (
                    <div className="p-5" key={queue.queue}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium capitalize">{queue.queue}</p>
                        <Badge variant={queue.workers.length ? "success" : "warning"}>
                          {queue.workers.length ? `${queue.workers.length} online` : "No worker"}
                        </Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <Metric
                          label="Waiting"
                          value={
                            queue.counts.waiting + queue.counts.prioritized + queue.counts.delayed
                          }
                        />
                        <Metric label="Running" value={queue.counts.active} />
                        <Metric
                          label="Failed"
                          value={queue.counts.failed}
                          warn={queue.counts.failed > 0}
                        />
                      </dl>
                    </div>
                  ))}
                </div>
              </OperationsListShell>
              <OperationsListShell
                status={`${jobResult.data.runs.length} recent`}
                toolbar={
                  <div>
                    <h2 className="font-semibold">Jobs needing attention</h2>
                    <p className="text-sm text-muted-foreground">
                      Queued, running, and failed work
                    </p>
                  </div>
                }
              >
                <div className="divide-y">
                  {jobResult.data.runs.map((run) => (
                    <div className="flex flex-wrap items-center gap-3 px-5 py-4" key={run.id}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{formatJobName(run.name)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Attempt {run.attempts} of {run.maxAttempts} · Updated{" "}
                          {formatRelative(run.updatedAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          run.status === "failed"
                            ? "destructive"
                            : run.status === "active"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {run.status}
                      </Badge>
                      {canControlJobs && run.canRetry ? (
                        <JobControlAction action="retry" jobName={run.name} jobRunId={run.id} />
                      ) : null}
                      {canControlJobs && run.canCancel ? (
                        <JobControlAction action="cancel" jobName={run.name} jobRunId={run.id} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </OperationsListShell>
            </>
          ) : null}
          <OperationsListShell
            status="Checked on refresh"
            toolbar={
              <div>
                <h2 className="font-semibold">Service availability</h2>
                <p className="text-sm text-muted-foreground">Current dependency checks</p>
              </div>
            }
          >
            <div className="divide-y">
              {[...result.data.dependencies]
                .sort(
                  (left, right) =>
                    dependencyPriority(left.status) - dependencyPriority(right.status),
                )
                .map((dependency) => {
                  const presentation = dependencyPresentation(dependency.id);
                  const Icon = presentation.icon;
                  return (
                    <div
                      className="flex flex-wrap items-center gap-4 px-5 py-4"
                      key={dependency.id}
                    >
                      <span className="text-muted-foreground">
                        <Icon aria-hidden className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{presentation.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dependency.evidence === "request"
                            ? "Confirmed by this successful operations request"
                            : dependency.status === "not_configured"
                              ? "Not configured for this environment"
                              : dependency.latencyMs === null
                                ? "Checked now"
                                : `Responded in ${dependency.latencyMs} ms`}
                        </p>
                      </div>
                      <Badge variant={dependencyVariant(dependency.status)}>
                        {dependency.status === "operational"
                          ? "Available"
                          : dependency.status === "unavailable"
                            ? "Unavailable"
                            : "Not configured"}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </OperationsListShell>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <EvidenceCard
              empty="No background work has been recorded."
              title="Background work by type"
            >
              {result.data.backgroundWork.types.map((job) => (
                <EvidenceRow
                  detail={
                    job.active
                      ? `${job.active} running`
                      : job.queued
                        ? `${job.queued} waiting`
                        : job.lastCompletedAt
                          ? `Last completed ${formatRelative(job.lastCompletedAt)}`
                          : "No completed run recorded"
                  }
                  key={job.name}
                  label={formatJobName(job.name)}
                  warning={job.failedLast24Hours}
                />
              ))}
            </EvidenceCard>
            <EvidenceCard
              empty="No notification delivery has been recorded."
              title="Notification delivery by channel"
            >
              {result.data.notifications.channels.map((channel) => (
                <EvidenceRow
                  detail={
                    channel.retrying
                      ? `${channel.retrying} retrying`
                      : channel.pending
                        ? `${channel.pending} waiting`
                        : channel.lastSentAt
                          ? `Last sent ${formatRelative(channel.lastSentAt)}`
                          : "No successful delivery recorded"
                  }
                  key={channel.channel}
                  label={formatChannel(channel.channel)}
                  warning={channel.failedLast24Hours}
                />
              ))}
            </EvidenceCard>
          </div>
        </>
      )}
    </div>
  );
}

function dependencyPresentation(
  id:
    | "platform_database"
    | "commerce_backend"
    | "storefront_runtime"
    | "job_queue"
    | "media_storage",
) {
  return {
    platform_database: { label: "Platform database", icon: Database },
    commerce_backend: { label: "Commerce backend", icon: ShoppingBag },
    storefront_runtime: { label: "Storefront runtime", icon: Store },
    job_queue: { label: "Background work queue", icon: ServerCog },
    media_storage: { label: "Media storage", icon: HardDrive },
  }[id];
}

function dependencyVariant(status: "operational" | "unavailable" | "not_configured") {
  if (status === "operational") return "success" as const;
  if (status === "unavailable") return "destructive" as const;
  return "secondary" as const;
}

function dependencyPriority(status: "operational" | "unavailable" | "not_configured") {
  return status === "unavailable" ? 0 : status === "not_configured" ? 1 : 2;
}

function EvidenceCard({
  children,
  empty,
  title,
}: {
  children: ReactNode;
  empty: string;
  title: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Current work plus successful and failed activity recorded by ECS.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {items.length ? items : <p className="p-5 text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function EvidenceRow({
  detail,
  label,
  warning,
}: {
  detail: string;
  label: string;
  warning: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={warning ? "destructive" : "outline"}>
        {warning ? `${warning} failed in 24h` : "No recent failures"}
      </Badge>
    </div>
  );
}

function HealthCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: typeof Clock3;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <span className="mb-3 grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden className="size-4" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0">{children}</CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          warn
            ? "font-semibold tabular-nums text-warning-foreground dark:text-warning"
            : "font-semibold tabular-nums"
        }
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
function formatAge(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatRelative(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function formatJobName(value: string) {
  const labels: Record<string, string> = {
    "analytics.commerce-rollup": "Insights reporting",
    "billing.lifecycle": "Subscription lifecycle",
    "billing.reconcile-payments": "Payment reconciliation",
    "product-import.apply": "Product imports",
    "system.ping": "Worker availability check",
  };
  return labels[value] ?? formatStatusLabel(value);
}

function formatChannel(value: string) {
  return value.toLowerCase() === "telegram" ? "Telegram" : formatStatusLabel(value);
}

function formatStatusLabel(value: string) {
  return value.replaceAll(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
