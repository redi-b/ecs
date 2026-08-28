import { ShieldCheck, UsersRound } from "lucide-react";
import { headers } from "next/headers";

import { OperatorReadError } from "@/components/operator-read-error";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Access</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Operators</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          People authorized to work in ECS Operations and the access currently assigned to them.
        </p>
      </header>
      {!result.ok ? (
        <OperatorReadError
          resource="Operator access"
          status={result.status}
          unavailableDescription="Operator assignments could not be loaded. No access was changed."
        />
      ) : result.data.operators.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {result.data.operators.map((operator) => (
            <Card key={operator.principalId}>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(operator.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{operator.name}</CardTitle>
                    <p className="truncate text-sm text-muted-foreground">{operator.email}</p>
                  </div>
                  <Badge variant={operator.status === "active" ? "success" : "destructive"}>
                    {operator.status === "active" ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-primary" /> {operator.permissions.length}{" "}
                  permissions
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {groupPermissions(operator.permissions).map((group) => (
                    <Badge key={group} variant="outline">
                      {group}
                    </Badge>
                  ))}
                </div>
                <details className="group mt-5 rounded-xl border bg-muted/20">
                  <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium outline-none marker:hidden focus-visible:ring-3 focus-visible:ring-ring/50">
                    View assigned access
                  </summary>
                  <div className="divide-y border-t">
                    {operator.access.length ? (
                      operator.access.map((item) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                          key={item.permission}
                        >
                          <span className="text-sm">{formatPermission(item.permission)}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.expiresAt ? `Ends ${formatDate(item.expiresAt)}` : "No expiry"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No active access is assigned.
                      </p>
                    )}
                  </div>
                </details>
                <p className="mt-5 text-xs text-muted-foreground">
                  Access last changed {formatDate(operator.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="rounded-2xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>No operators found</EmptyTitle>
            <EmptyDescription>
              No platform operator principals are currently configured.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
