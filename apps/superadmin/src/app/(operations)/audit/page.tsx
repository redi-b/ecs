import { ChevronRight, FileClock, Search, SlidersHorizontal, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatAuditAction } from "@/lib/format-audit-action";
import { getOperatorAudit } from "@/lib/platform-api/superadmin/console";

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const category = getCategory(params.category);
  const filters = getAuditFilters(params);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const limit = 25;
  const requestHeaders = await headers();
  const result = await getOperatorAudit({
    cookieHeader: requestHeaders.get("cookie"),
    ...(category ? { category } : {}),
    ...filters,
    limit,
    offset: (page - 1) * limit,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  }).catch(() => ({ ok: false as const, message: "operator_audit_unavailable", status: 503 }));
  if (result.ok && page > 1 && result.data.events.length === 0 && result.data.count > 0) {
    redirect(createAuditHref(category, filters, Math.ceil(result.data.count / limit)));
  }
  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        title="Audit"
        description="Review recorded platform and merchant changes."
      />
      <nav
        aria-label="Filter audit activity type"
        className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      >
        {[
          [undefined, "All activity"],
          ["merchant", "Merchant accounts"],
          ["support", "Support access"],
          ["billing", "Billing and plans"],
          ["provisioning", "Shop setup"],
        ].map(([value, label]) => (
          <Button
            asChild
            key={value ?? "all"}
            size="sm"
            variant={category === value ? "secondary" : "ghost"}
          >
            <Link
              aria-current={category === value ? "page" : undefined}
              href={createAuditHref(value as AuditCategory | undefined, filters, 1)}
            >
              {label}
            </Link>
          </Button>
        ))}
      </nav>
      <details
        className="group rounded-xl border bg-card"
        open={hasAuditFilters(filters) || undefined}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium marker:hidden">
          <SlidersHorizontal aria-hidden className="size-4" /> Filters
          {hasAuditFilters(filters) ? (
            <Badge variant="secondary">{Object.values(filters).filter(Boolean).length}</Badge>
          ) : null}
        </summary>
        <form className="border-t p-4" method="get">
          {category ? <input name="category" type="hidden" value={category} /> : null}
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Find recorded activity</h2>
            {hasAuditFilters(filters) ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={createAuditHref(category, {}, 1)}>
                  <X data-icon="inline-start" /> Clear filters
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterField
              label="Merchant"
              name="merchant"
              placeholder="Name or handle"
              value={filters.merchant}
            />
            <FilterField
              label="Operator"
              name="actor"
              placeholder="Name or email"
              value={filters.actor}
            />
            <FilterField
              label="Action"
              name="action"
              placeholder="For example, support access"
              value={filters.action}
            />
            <FilterField
              label="Resource"
              name="resource"
              placeholder="Type or reference"
              value={filters.resource}
            />
            <div className="flex flex-col gap-2">
              <Label>Outcome</Label>
              <Select defaultValue={filters.outcome ?? "all"} name="outcome">
                <SelectTrigger aria-label="Outcome" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Any outcome</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="unknown">Outcome unavailable</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <FilterField label="From" name="from" type="date" value={filters.from} />
            <FilterField label="To" name="to" type="date" value={filters.to} />
            <div className="flex items-end">
              <Button className="w-full" type="submit">
                <Search data-icon="inline-start" /> Apply filters
              </Button>
            </div>
          </div>
        </form>
      </details>
      {!result.ok ? (
        <OperatorReadError
          resource="Audit history"
          status={result.status}
          unavailableDescription="Recorded changes could not be loaded."
        />
      ) : result.data.events.length ? (
        <>
          <OperationsListShell status={`${result.data.count} events`}>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b bg-muted/25 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid-cols-[1.2fr_1fr_1fr_12rem_auto]">
              <span>Change</span>
              <span className="hidden lg:block">Operator</span>
              <span className="hidden lg:block">Merchant</span>
              <span>Time</span>
              <span className="hidden w-4 lg:block" />
            </div>
            {result.data.events.map((event) => (
              <Sheet key={event.id}>
                <SheetTrigger asChild>
                  <button
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 text-left transition-colors last:border-0 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 lg:grid-cols-[1.2fr_1fr_1fr_12rem_auto]"
                    type="button"
                  >
                    <div>
                      <p className="text-sm font-medium">{formatAuditAction(event.action)}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant={getOutcomeVariant(event.outcome)}>
                          {formatOutcome(event.outcome)}
                        </Badge>
                        <Badge variant="outline">{formatTarget(event.targetType)}</Badge>
                      </div>
                    </div>
                    <p className="hidden truncate text-sm text-muted-foreground lg:block">
                      {event.actor?.name ?? "System"}
                    </p>
                    <div className="hidden min-w-0 lg:block">
                      {event.merchant ? (
                        <span className="truncate text-sm font-medium">{event.merchant.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Platform</span>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                      {formatDate(event.createdAt)}
                    </time>
                    <ChevronRight
                      aria-hidden
                      className="hidden size-4 text-muted-foreground lg:block"
                    />
                  </button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                  <SheetHeader className="border-b pe-12">
                    <SheetTitle>{formatAuditAction(event.action)}</SheetTitle>
                    <SheetDescription>{formatDate(event.createdAt)}</SheetDescription>
                  </SheetHeader>
                  <dl className="divide-y overflow-y-auto">
                    <AuditDetail label="Outcome" value={formatOutcome(event.outcome)} />
                    <AuditDetail
                      label="Operator"
                      value={event.actor ? `${event.actor.name} · ${event.actor.email}` : "System"}
                    />
                    <AuditDetail
                      label="Merchant"
                      value={
                        event.merchant
                          ? `${event.merchant.name} · @${event.merchant.handle}`
                          : "Platform"
                      }
                    />
                    <AuditDetail label="Resource" value={formatTarget(event.targetType)} />
                    <AuditDetail
                      label="Resource reference"
                      value={event.targetId ?? "Not recorded"}
                      mono
                    />
                    <AuditDetail label="Event reference" value={event.id} mono />
                    <AuditDetail label="Correlation reference" value={event.correlationId} mono />
                  </dl>
                  {event.merchant ? (
                    <div className="border-t p-4">
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/tenants/${event.merchant.id}`}>Open merchant</Link>
                      </Button>
                    </div>
                  ) : null}
                </SheetContent>
              </Sheet>
            ))}
          </OperationsListShell>
          <OperationsPagination
            basePath="/audit"
            count={result.data.count}
            page={page}
            pageSize={limit}
            resourceLabel="audit events"
            searchParams={{ category, ...filters }}
          />
        </>
      ) : (
        <OperationsDataState
          icon={FileClock}
          title={
            category || hasAuditFilters(filters) ? "No matching activity" : "No audit activity yet"
          }
          description={
            category || hasAuditFilters(filters)
              ? "No recorded changes match the selected filters."
              : "Recorded platform changes will appear here."
          }
        />
      )}
    </div>
  );
}

function AuditDetail({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 break-words text-sm"}>
        {value}
      </dd>
    </div>
  );
}

type AuditCategory = "billing" | "merchant" | "provisioning" | "support";
type AuditFilters = {
  action?: string;
  actor?: string;
  from?: string;
  merchant?: string;
  outcome?: "accepted" | "completed" | "failed" | "unknown";
  resource?: string;
  to?: string;
};

function getCategory(value: string | undefined): AuditCategory | undefined {
  return value === "billing" ||
    value === "merchant" ||
    value === "provisioning" ||
    value === "support"
    ? value
    : undefined;
}

function getAuditFilters(params: Record<string, string | undefined>): AuditFilters {
  const outcome = getOutcome(params.outcome);
  return {
    ...bounded("action", params.action),
    ...bounded("actor", params.actor),
    ...bounded("merchant", params.merchant),
    ...(outcome ? { outcome } : {}),
    ...bounded("resource", params.resource),
    ...validDate("from", params.from),
    ...validDate("to", params.to),
  };
}

function createAuditHref(category: AuditCategory | undefined, filters: AuditFilters, page: number) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/audit?${query}` : "/audit";
}

function FilterField({
  label,
  name,
  placeholder,
  type = "search",
  value,
}: {
  label: string;
  name: keyof AuditFilters;
  placeholder?: string;
  type?: "date" | "search";
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`audit-${name}`}>{label}</Label>
      <Input
        defaultValue={value}
        id={`audit-${name}`}
        maxLength={100}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function bounded<K extends "action" | "actor" | "merchant" | "resource">(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  const normalized = value?.trim().slice(0, 100);
  return normalized ? ({ [key]: normalized } as Partial<Record<K, string>>) : {};
}

function validDate<K extends "from" | "to">(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? ({ [key]: value } as Partial<Record<K, string>>)
    : {};
}

function getOutcome(value: string | undefined): AuditFilters["outcome"] {
  return value === "accepted" || value === "completed" || value === "failed" || value === "unknown"
    ? value
    : undefined;
}

function hasAuditFilters(filters: AuditFilters) {
  return Object.values(filters).some(Boolean);
}

function formatTarget(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatOutcome(value: "accepted" | "completed" | "failed" | "unknown") {
  if (value === "accepted") return "Accepted";
  if (value === "failed") return "Failed";
  if (value === "unknown") return "Outcome unavailable";
  return "Completed";
}
function getOutcomeVariant(value: "accepted" | "completed" | "failed" | "unknown") {
  if (value === "accepted") return "info" as const;
  if (value === "failed") return "destructive" as const;
  if (value === "unknown") return "secondary" as const;
  return "success" as const;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
