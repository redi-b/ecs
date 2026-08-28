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
import { OperatorReadError } from "@/components/operator-read-error";
import { RefreshPageButton } from "@/components/refresh-page-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformHealth } from "@/lib/platform-api/superadmin/console";

export default async function HealthPage() {
  const requestHeaders = await headers();
  const result = await getPlatformHealth({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "operator_health_unavailable", status: 503 }));

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Platform status
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Health</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review queue delays, recent delivery failures, and merchant account status.
          </p>
        </div>
        <RefreshPageButton />
      </header>
      {!result.ok ? (
        <OperatorReadError
          resource="Health data"
          status={result.status}
          unavailableDescription="The platform could not read its operational state."
        />
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-xs">
            <span
              className={
                result.data.status === "clear"
                  ? "grid size-10 place-items-center rounded-xl bg-success/12 text-success"
                  : "grid size-10 place-items-center rounded-xl bg-warning/15 text-warning-foreground"
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Service availability</CardTitle>
              <CardDescription>
                Bounded checks made when this page was refreshed. Configuration-only states are not
                presented as successful checks.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {result.data.dependencies.map((dependency) => {
                const presentation = dependencyPresentation(dependency.id);
                const Icon = presentation.icon;
                return (
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4" key={dependency.id}>
                    <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
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
            </CardContent>
          </Card>
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
