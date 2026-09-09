import { ChevronRight, UsersRound } from "lucide-react";
import { headers } from "next/headers";
import { OperationsDataState } from "@/components/operations-data-state";
import { OperationsListShell } from "@/components/operations-list-shell";
import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperationsStatusBadge } from "@/components/operations-status-badge";
import { OperatorReadError } from "@/components/operator-read-error";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getPlatformOperators } from "@/lib/platform-api/superadmin/console";

export default async function OperatorsPage() {
  const requestHeaders = await headers();
  const result = await getPlatformOperators({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "operators_unavailable", status: 503 }));
  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Operators"
        description="Review who can access Operations and what they can do."
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Operator access"
          status={result.status}
          unavailableDescription="Operator assignments could not be loaded. No access was changed."
        />
      ) : result.data.operators.length ? (
        <OperationsListShell status={`${result.data.operators.length} operators`}>
          <div className="divide-y">
            {result.data.operators.map((operator) => {
              const groups = groupPermissions(operator.permissions);
              return (
                <Sheet key={operator.principalId}>
                  <SheetTrigger asChild>
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-5"
                      type="button"
                    >
                      <Avatar className="size-10">
                        <AvatarFallback>{initials(operator.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{operator.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{operator.email}</p>
                      </div>
                      <div className="hidden flex-1 flex-wrap justify-end gap-1.5 md:flex">
                        {groups.map((group) => (
                          <Badge key={group} variant="outline">
                            {group}
                          </Badge>
                        ))}
                      </div>
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
                        {operator.permissions.length} permissions
                      </span>
                      <OperationsStatusBadge status={operator.status} />
                      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                    </button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader className="border-b pe-12">
                      <SheetTitle>{operator.name}</SheetTitle>
                      <SheetDescription>{operator.email}</SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="flex flex-wrap gap-2 border-b p-4">
                        <OperationsStatusBadge status={operator.status} />
                        {groups.map((group) => (
                          <Badge key={group} variant="outline">
                            {group}
                          </Badge>
                        ))}
                      </div>
                      <div className="divide-y">
                        {operator.access.length ? (
                          operator.access.map((item) => (
                            <div className="flex flex-col gap-1 px-4 py-3" key={item.permission}>
                              <span className="text-sm">{formatPermission(item.permission)}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.expiresAt
                                  ? `Ends ${formatDate(item.expiresAt)}`
                                  : "No expiry"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-muted-foreground">
                            No active access is assigned.
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="border-t p-4 text-xs text-muted-foreground">
                      Access last changed {formatDate(operator.updatedAt)}
                    </p>
                  </SheetContent>
                </Sheet>
              );
            })}
          </div>
        </OperationsListShell>
      ) : (
        <OperationsDataState
          icon={UsersRound}
          title="No operators found"
          description="No operator accounts are configured."
        />
      )}
    </div>
  );
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "OP"
  );
}
function groupPermissions(permissions: string[]) {
  return [
    ...new Set(
      permissions.map(
        (permission) =>
          (
            ({
              billing: "Billing",
              payments: "Payments",
              platform: "Platform",
              tenants: "Merchants",
            }) as Record<string, string>
          )[permission.split(".")[0] ?? ""] ?? "Other",
      ),
    ),
  ];
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatPermission(value: string) {
  const labels: Record<string, string> = {
    "billing.entitlements.read": "View plan exceptions",
    "billing.entitlements.update": "Manage plan exceptions",
    "billing.invoices.read": "View invoices",
    "billing.invoices.update": "Manage invoice decisions",
    "billing.plans.read": "View plans",
    "billing.plans.update": "Prepare and publish plan versions",
    "billing.subscriptions.update": "Move merchants between plan versions",
    "payments.onboarding.read": "View payment setup requests",
    "payments.onboarding.review": "Review payment setup requests",
    "platform.audit.read": "View audit history",
    "platform.health.read": "View platform health",
    "platform.operators.read": "View operators",
    "platform.overview.read": "View operations overview",
    "platform.work.read": "View recovery work",
    "platform.work.retry": "Recover failed shop setup",
    "tenants.diagnostics.read": "View merchant diagnostics",
    "tenants.operations.read": "View merchant operations",
    "tenants.read": "View merchants",
    "tenants.status.update": "Suspend and restore merchants",
    "tenants.support.access.manage": "Manage temporary support access",
    "tenants.support.access.read": "View temporary support access",
    "tenants.support.note.create": "Add internal support notes",
    "tenants.support.read": "View support history",
  };
  return labels[value] ?? "Additional operations access";
}
