import type { SuperadminOperationalSummary } from "@ecs/contracts";
import { ExternalLink, Store } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsStatusBadge } from "@/components/operations-status-badge";
import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { CommerceReviewWorkspace } from "@/features/superadmin/commerce-review-workspace";
import { MerchantTeamInspector } from "@/features/superadmin/merchant-team-inspector";
import { OperationalDiagnostics } from "@/features/superadmin/operational-diagnostics";
import { SubscriptionPlanControl } from "@/features/superadmin/subscription-plan-control";
import { SupportAccessControl } from "@/features/superadmin/support-access-control";
import { SupportWorkspace } from "@/features/superadmin/support-workspace";
import { TenantStatusControl } from "@/features/superadmin/tenant-status-control";
import { getOpsAccess } from "@/lib/ops-access";
import { getOperatorPlanCatalog } from "@/lib/platform-api/superadmin/billing";
import { getSuperadminCommerceReview } from "@/lib/platform-api/superadmin/commerce-review";
import { getSuperadminDiagnostics } from "@/lib/platform-api/superadmin/diagnostics";
import { getSuperadminOperationalSummary } from "@/lib/platform-api/superadmin/operations";
import { getSuperadminSupportHistory } from "@/lib/platform-api/superadmin/support";
import { getSuperadminSupportAccess } from "@/lib/platform-api/superadmin/support-access";
import { getSuperadminMerchantTeam } from "@/lib/platform-api/superadmin/team-access";
import { getSuperadminTenant } from "@/lib/platform-api/superadmin/tenants";
import { cn } from "@/lib/utils";

const workspaceTabs = [
  {
    id: "overview",
    label: "Overview",
    permissions: ["tenants.operations.read", "tenants.diagnostics.read"],
  },
  {
    id: "commerce",
    label: "Commerce",
    permissions: ["billing.invoices.read", "payments.onboarding.read"],
  },
  {
    id: "support",
    label: "Support",
    permissions: ["tenants.support.read"],
  },
  {
    id: "access",
    label: "Access",
    permissions: ["tenants.support.access.read"],
  },
  {
    id: "controls",
    label: "Controls",
    permissions: ["tenants.status.update", "billing.subscriptions.update"],
  },
] as const;
export default async function MerchantWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { tenantId } = await params;
  const access = await getOpsAccess();
  if (!access.ok) notFound();
  const visibleTabs = workspaceTabs.filter((tab) =>
    tab.permissions.some((permission) => access.permissions.includes(permission)),
  );
  const requestedView = (await searchParams)?.view;
  const activeTab =
    visibleTabs.find((tab) => tab.id === requestedView)?.id ?? visibleTabs[0]?.id ?? "overview";
  const requestHeaders = await headers();
  const common = {
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
    tenantId,
  };
  const tenantResult = await getSuperadminTenant(common);
  if (!tenantResult.ok) {
    if (tenantResult.status === 404) notFound();
    return (
      <div className="space-y-6">
        <OperatorReadError
          resource="Merchant workspace"
          status={tenantResult.status}
          unavailableDescription="This merchant’s operational details could not be loaded."
        />
      </div>
    );
  }
  const tenant = tenantResult.data.tenant;

  const operations = access.permissions.includes("tenants.operations.read")
    ? await getSuperadminOperationalSummary(common)
    : null;
  const diagnostics =
    activeTab === "overview" && access.permissions.includes("tenants.diagnostics.read")
      ? await getSuperadminDiagnostics(common)
      : null;
  const commerceReview =
    (activeTab === "commerce" ||
      (activeTab === "controls" && access.permissions.includes("billing.subscriptions.update"))) &&
    (access.permissions.includes("billing.invoices.read") ||
      access.permissions.includes("payments.onboarding.read"))
      ? await getSuperadminCommerceReview(common)
      : null;
  const planCatalog =
    activeTab === "controls" &&
    access.permissions.includes("billing.subscriptions.update") &&
    access.permissions.includes("billing.plans.read")
      ? await getOperatorPlanCatalog(common)
      : null;
  const support =
    activeTab === "support" && access.permissions.includes("tenants.support.read")
      ? await getSuperadminSupportHistory(common)
      : null;
  const supportAccess =
    activeTab === "access" && access.permissions.includes("tenants.support.access.read")
      ? await getSuperadminSupportAccess(common)
      : null;
  const merchantTeam =
    activeTab === "access" && access.permissions.includes("tenants.support.access.read")
      ? await getSuperadminMerchantTeam(common)
      : null;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <Store aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.03em]">
                  {tenant.name}
                </h1>
                <OperationsStatusBadge status={tenant.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">@{tenant.handle}</p>
              {tenant.ownerEmail ? (
                <p className="mt-1 text-sm text-muted-foreground">{tenant.ownerEmail}</p>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                {tenant.primaryDomainHostname ?? "No storefront address assigned"}
              </p>
            </div>
          </div>
          {tenant.primaryDomainHostname ? (
            <Button asChild variant="outline">
              <a href={`https://${tenant.primaryDomainHostname}`} rel="noreferrer" target="_blank">
                Open storefront <ExternalLink aria-hidden data-icon="inline-end" />
              </a>
            </Button>
          ) : null}
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Detail
            label="Plan"
            value={
              operations?.ok && operations.summary.billing.available
                ? (operations.summary.billing.planName ?? "No plan")
                : "Not available"
            }
          />
          <Detail label="Storefront" value={tenant.primaryDomainHostname ?? "Not assigned"} />
          <Detail label="Owner email" value={tenant.ownerEmail ?? "Not available"} />
          <Detail label="Created" value={formatDate(tenant.createdAt)} />
          <Detail label="Last changed" value={formatDate(tenant.updatedAt)} />
          <Detail label="Merchant reference" value={tenant.id} mono />
        </dl>
      </header>

      <WorkspaceNavigation
        active={activeTab}
        ariaLabel="Merchant workspace"
        basePath={`/tenants/${tenantId}`}
        items={visibleTabs.map(({ id, label }) => ({ id, label }))}
      />

      {activeTab === "overview" ? (
        <div className="flex flex-col gap-5">
          {operations?.ok ? <OperationalHealth summary={operations.summary} /> : null}
          {operations && !operations.ok ? (
            <OperatorReadError
              resource="Operational health"
              status={operations.status}
              unavailableDescription="This merchant’s readiness summary could not be loaded."
            />
          ) : null}
          {diagnostics?.ok ? (
            <OperationalDiagnostics diagnostics={diagnostics.diagnostics} />
          ) : null}
          {diagnostics && !diagnostics.ok ? (
            <OperatorReadError
              resource="Operational diagnostics"
              status={diagnostics.status}
              unavailableDescription="Recent jobs, media, and notification records could not be loaded."
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === "support" && support?.ok ? (
        <SupportWorkspace
          canCreateNote={access.permissions.includes("tenants.support.note.create")}
          initialHistory={support.history}
          tenantId={tenantId}
        />
      ) : null}

      {activeTab === "commerce" && commerceReview?.ok ? (
        <CommerceReviewWorkspace
          canReviewPayments={access.permissions.includes("payments.onboarding.review")}
          canUpdateInvoices={access.permissions.includes("billing.invoices.update")}
          review={commerceReview.review}
          tenantId={tenantId}
        />
      ) : null}
      {activeTab === "commerce" && commerceReview && !commerceReview.ok ? (
        <OperatorReadError
          resource="Commerce review"
          status={commerceReview.status}
          unavailableDescription="Billing and payment-review information could not be loaded."
        />
      ) : null}
      {activeTab === "support" && support && !support.ok ? (
        <OperatorReadError
          resource="Support history"
          status={support.status}
          unavailableDescription="Notes and recorded support activity could not be loaded."
        />
      ) : null}

      {activeTab === "access" && supportAccess?.ok ? (
        <div className="space-y-5">
          {merchantTeam?.ok ? <MerchantTeamInspector team={merchantTeam.team} /> : null}
          <SupportAccessControl
            canManage={access.permissions.includes("tenants.support.access.manage")}
            currentOperatorUserId={access.operator.id}
            dashboardUrl={
              tenant.primaryDomainHostname
                ? `${tenant.primaryDomainHostname.endsWith(".lvh.me") ? "http" : "https"}://${tenant.primaryDomainHostname}/admin`
                : null
            }
            grants={supportAccess.grants}
            tenantId={tenantId}
          />
        </div>
      ) : null}
      {activeTab === "access" && supportAccess && !supportAccess.ok ? (
        <OperatorReadError
          resource="Support access"
          status={supportAccess.status}
          unavailableDescription="Current support access grants could not be loaded."
        />
      ) : null}
      {activeTab === "access" && merchantTeam && !merchantTeam.ok ? (
        <OperatorReadError
          resource="Merchant team"
          status={merchantTeam.status}
          unavailableDescription="The merchant organization membership could not be loaded."
        />
      ) : null}

      {activeTab === "controls" ? (
        <div className="space-y-5">
          {access.permissions.includes("billing.subscriptions.update") &&
          planCatalog?.ok &&
          commerceReview?.ok &&
          commerceReview.review.billing ? (
            <SubscriptionPlanControl
              catalog={planCatalog.data}
              currentPlanName={commerceReview.review.billing.planName}
              currentPlanVersionId={commerceReview.review.billing.planVersionId}
              tenantId={tenantId}
            />
          ) : null}
          {access.permissions.includes("tenants.status.update") ? (
            tenant.status === "active" || tenant.status === "suspended" ? (
              <TenantStatusControl status={tenant.status} tenantId={tenantId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No status action available</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {tenant.status === "draft"
                    ? "This merchant is still being prepared and cannot be suspended or restored."
                    : "This merchant account is closed and cannot be restored from this workspace."}
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OperationalHealth({ summary }: { summary: SuperadminOperationalSummary }) {
  const checks = [
    ["Merchant", summary.readiness.tenantReady],
    ["Storefront address", summary.readiness.domainReady],
    ["Commerce", summary.readiness.commerceReady],
    ["Storefront", summary.readiness.storefrontReady],
    ["Shop setup", summary.readiness.provisioningReady],
  ] as const;
  return (
    <OperationsListShell
      status={
        <Badge variant={summary.readiness.ready ? "success" : "warning"}>
          {summary.readiness.ready ? "Ready" : "Needs attention"}
        </Badge>
      }
      toolbar={
        <div>
          <h2 className="font-semibold">Operational readiness</h2>
          {!summary.readiness.ready ? (
            <p className="text-sm text-muted-foreground">
              Review {formatReadinessGaps(summary.readiness.missing)}.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="divide-y">
        {checks.map(([label, ready]) => (
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5" key={label}>
            <span className="text-sm">{label}</span>
            <Badge variant={ready ? "success" : "warning"}>{ready ? "Ready" : "Check"}</Badge>
          </div>
        ))}
        <div className="p-4 sm:p-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Open invoices" value={String(summary.billing.pendingInvoiceCount)} />
            <Detail label="Storefront addresses" value={String(summary.domains.total)} />
            <Detail label="Payment reviews" value={String(summary.payments.pendingReview)} />
          </dl>
        </div>
      </div>
    </OperationsListShell>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function formatReadinessGaps(values: string[]) {
  if (!values.length) return "the incomplete setup items";
  const labels = values.map((value) => {
    const normalized = value.toLowerCase();
    if (normalized.includes("domain")) return "the storefront address";
    if (normalized.includes("commerce")) return "commerce setup";
    if (normalized.includes("storefront")) return "the storefront";
    if (normalized.includes("provision")) return "shop setup";
    if (normalized.includes("tenant")) return "the merchant account";
    return "an incomplete setup item";
  });
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format([
    ...new Set(labels),
  ]);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
