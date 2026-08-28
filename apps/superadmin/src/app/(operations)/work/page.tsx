import { AlertTriangle, CheckCircle2, Clock3, ServerCog, Store } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OperationsPagination } from "@/components/operations-pagination";
import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Queue</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Work</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Investigate failed shop setup and recent background processing failures.
        </p>
      </header>
      <nav aria-label="Work type" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={kind === "shop_setup" ? "secondary" : "outline"}>
          <Link aria-current={kind === "shop_setup" ? "page" : undefined} href="/work">
            <Store data-icon="inline-start" /> Shop setup
          </Link>
        </Button>
        <Button asChild size="sm" variant={kind === "background_job" ? "secondary" : "outline"}>
          <Link
            aria-current={kind === "background_job" ? "page" : undefined}
            href="/work?kind=background_job"
          >
            <ServerCog data-icon="inline-start" /> Background failures
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
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  {kind === "shop_setup" ? "Shop setup" : "Recent background failures"}
                </CardTitle>
                <Badge variant="destructive">
                  {result.data.count} {kind === "shop_setup" ? "open" : "in 7 days"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {result.data.items.map((item) =>
                item.kind === "shop_setup" ? (
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4" key={item.id}>
                    <span className="grid size-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                      <AlertTriangle aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.merchantName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        @{item.handle} · {formatStep(item.step)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">{formatFailure(item.failureCategory)}</Badge>
                      <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" /> {formatDate(item.createdAt)}
                      </p>
                    </div>
                    {item.retryable && canRecover ? (
                      <WorkRecoveryAction attemptId={item.id} merchantName={item.merchantName} />
                    ) : (
                      <Badge variant="outline">Review only</Badge>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4" key={item.id}>
                    <span className="grid size-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                      <ServerCog aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{formatJobName(item.jobName)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.merchant ? `@${item.merchant.handle}` : "Platform-wide work"} ·
                        Attempt {item.attempts} of {item.maxAttempts}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">{formatFailure(item.failureCategory)}</Badge>
                      <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" /> {formatDate(item.finishedAt)}
                      </p>
                    </div>
                    {item.merchant ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tenants/${item.merchant.id}`}>Open merchant</Link>
                      </Button>
                    ) : (
                      <Badge variant="outline">Review only</Badge>
                    )}
                  </div>
                ),
              )}
            </CardContent>
          </Card>
          <OperationsPagination
            basePath="/work"
            count={result.data.count}
            page={page}
            pageSize={limit}
            searchParams={{ kind: kind === "background_job" ? kind : undefined }}
          />
        </>
      ) : (
        <Empty className="rounded-2xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2 />
            </EmptyMedia>
            <EmptyTitle>
              {kind === "shop_setup" ? "No setup failures" : "No recent background failures"}
            </EmptyTitle>
            <EmptyDescription>
              {kind === "shop_setup"
                ? "Every merchant’s latest shop setup attempt completed or remains in progress."
                : "No background work has failed during the last seven days."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
