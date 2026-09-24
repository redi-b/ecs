import { CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OperationsDataState } from "@/components/operations-data-state";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperationsPagination } from "@/components/operations-pagination";
import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkRecoveryAction } from "@/features/superadmin/work-recovery-action";
import { getOpsAccess } from "@/lib/ops-access";
import { getOperatorWork } from "@/lib/platform-api/superadmin/console";

export default async function WorkPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const kind = params.kind === "background_job" ? "background_job" : "shop_setup";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const limit = 20;
  const access = await getOpsAccess();
  const canRecover = access.ok && access.permissions.includes("platform.work.retry");
  const requestHeaders = await headers();
  const result = await getOperatorWork({
    cookieHeader: requestHeaders.get("cookie"),
    kind,
    limit,
    offset: (page - 1) * limit,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "operator_work_unavailable", status: 503 }));
  if (result.ok && page > 1 && result.data.items.length === 0 && result.data.count > 0) {
    redirect(createWorkHref(kind, Math.ceil(result.data.count / limit)));
  }

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader title="Work" description="Review failed setup and background work." />
      <nav aria-label="Work type" className="inline-flex w-fit rounded-lg border bg-muted/30 p-1">
        <Button asChild size="sm" variant={kind === "shop_setup" ? "secondary" : "ghost"}>
          <Link aria-current={kind === "shop_setup" ? "page" : undefined} href="/work">
            Shop setup
          </Link>
        </Button>
        <Button asChild size="sm" variant={kind === "background_job" ? "secondary" : "ghost"}>
          <Link
            aria-current={kind === "background_job" ? "page" : undefined}
            href="/work?kind=background_job"
          >
            Background failures
          </Link>
        </Button>
      </nav>
      {!result.ok ? (
        <OperatorReadError
          resource="Work queue"
          status={result.status}
          unavailableDescription="Operational work could not be loaded. No recovery action was started."
        />
      ) : result.data.items.length ? (
        <>
          <OperationsListShell
            status={`${result.data.count} ${kind === "shop_setup" ? "open" : "in the last 7 days"}`}
          >
            <div className="divide-y">
              {result.data.items.map((item) =>
                item.kind === "shop_setup" ? (
                  <div
                    className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"
                    key={item.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.merchantName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        @{item.handle} · {formatStep(item.step)} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <Badge variant="warning">{formatFailure(item.failureCategory)}</Badge>
                    {item.retryable && canRecover ? (
                      <WorkRecoveryAction attemptId={item.id} merchantName={item.merchantName} />
                    ) : null}
                  </div>
                ) : (
                  <div
                    className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"
                    key={item.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{formatJobName(item.jobName)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.merchant ? `@${item.merchant.handle}` : "Platform-wide work"} ·
                        Attempt {item.attempts} of {item.maxAttempts} ·{" "}
                        {formatDate(item.finishedAt)}
                      </p>
                    </div>
                    <Badge variant="warning">{formatFailure(item.failureCategory)}</Badge>
                    {item.merchant ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tenants/${item.merchant.id}`}>Open merchant</Link>
                      </Button>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </OperationsListShell>
          <OperationsPagination
            basePath="/work"
            count={result.data.count}
            page={page}
            pageSize={limit}
            resourceLabel="work items"
            searchParams={{ kind: kind === "background_job" ? kind : undefined }}
          />
        </>
      ) : (
        <OperationsDataState
          icon={CheckCircle2}
          title={kind === "shop_setup" ? "No setup failures" : "No recent background failures"}
          description={
            kind === "shop_setup"
              ? "Every merchant’s latest shop setup attempt completed or remains in progress."
              : "No background work has failed during the last seven days."
          }
        />
      )}
    </div>
  );
}

function createWorkHref(kind: "background_job" | "shop_setup", page: number) {
  const params = new URLSearchParams();
  if (kind === "background_job") params.set("kind", kind);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/work?${params}` : "/work";
}

function formatJobName(value: string) {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStep(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatFailure(value: string) {
  return (
    (
      {
        authentication: "Authentication",
        configuration: "Setup",
        network: "Connection",
        rate_limit: "Provider limit",
        timeout: "Timeout",
        validation: "Rejected data",
        unknown: "Unexpected",
      } as Record<string, string>
    )[value] ?? "Unexpected"
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
