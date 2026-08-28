import type { SuperadminDiagnostics } from "@ecs/contracts";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OperationalDiagnostics({ diagnostics }: { diagnostics: SuperadminDiagnostics }) {
  const failures = [
    ...diagnostics.jobs.recentFailures.map((failure) => ({
      key: `job-${failure.category}-${failure.createdAt}`,
      label: `${formatCategory(failure.category)} task`,
      detail: `${formatFailure(failure.failureCategory)} · attempt ${failure.attempts} of ${failure.maxAttempts}`,
      createdAt: failure.createdAt,
    })),
    ...diagnostics.notifications.recentFailures.map((failure) => ({
      key: `notification-${failure.eventType}-${failure.createdAt}`,
      label: `${formatCategory(failure.channel)} notification`,
      detail: `${formatCategory(failure.eventType)} · ${formatFailure(failure.failureCategory)}`,
      createdAt: failure.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Processing history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent media, task, and notification activity for this merchant.
          </p>
        </div>
        <Badge variant={failures.length || diagnostics.media.failed ? "warning" : "success"}>
          {failures.length + diagnostics.media.failed
            ? `${failures.length + diagnostics.media.failed} to review`
            : "Clear"}
        </Badge>
      </header>
      <div className="flex flex-col gap-5 p-5">
        <dl className="grid overflow-hidden rounded-xl border sm:grid-cols-3 sm:divide-x">
          <Metric label="Media ready" value={diagnostics.media.ready} />
          <Metric label="Media pending" value={diagnostics.media.pending} />
          <Metric label="Media failed" value={diagnostics.media.failed} />
        </dl>
        {failures.length ? (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CircleAlert
                aria-hidden
                className="size-4 text-warning-foreground dark:text-warning"
              />
              Recent issues
            </div>
            <ul className="divide-y rounded-xl border">
              {failures.map((failure) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  key={failure.key}
                >
                  <div>
                    <p className="text-sm font-medium">{failure.label}</p>
                    <p className="text-xs text-muted-foreground">{failure.detail}</p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={failure.createdAt}>
                    {formatDateTime(failure.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            <p className="text-sm text-muted-foreground">
              No recent task or notification issues need review.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFailure(value: string) {
  const labels: Record<string, string> = {
    authentication: "Authentication failed",
    configuration: "Setup needs attention",
    network: "Service connection failed",
    rate_limit: "Provider limit reached",
    timeout: "Request timed out",
    validation: "Information was rejected",
    unknown: "Unexpected failure",
  };
  return labels[value] ?? "Unexpected failure";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
