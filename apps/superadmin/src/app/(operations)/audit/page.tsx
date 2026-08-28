import { FileClock, Search, SlidersHorizontal, X } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OperationsPagination } from "@/components/operations-pagination";
import { OperatorReadError } from "@/components/operator-read-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Accountability
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Audit</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Recorded platform and merchant changes, in newest-first order.
        </p>
      </header>
      <nav aria-label="Filter audit activity type" className="flex flex-wrap gap-2">
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
            variant={category === value ? "secondary" : "outline"}
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
      <form className="rounded-2xl border bg-card p-4 shadow-xs" method="get">
        {category ? <input name="category" type="hidden" value={category} /> : null}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Find recorded activity</h2>
          </div>
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
      {!result.ok ? (
        <OperatorReadError
          resource="Audit history"
          status={result.status}
          unavailableDescription="Recorded changes could not be loaded."
        />
      ) : result.data.events.length ? (
        <>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b bg-muted/35 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid-cols-[1.2fr_1fr_1fr_12rem]">
              <span>Change</span>
              <span className="hidden lg:block">Operator</span>
              <span className="hidden lg:block">Merchant</span>
              <span>Time</span>
            </div>
            {result.data.events.map((event) => (
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 last:border-0 lg:grid-cols-[1.2fr_1fr_1fr_12rem]"
                key={event.id}
              >
                <div>
                  <p className="text-sm font-medium">{formatAuditAction(event.action)}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={getOutcomeVariant(event.outcome)}>
                      {formatOutcome(event.outcome)}
                    </Badge>
                    <Badge variant="outline">{formatTarget(event.targetType)}</Badge>
                  </div>
                  {event.targetId ? (
                    <p
                      className="mt-1 max-w-72 truncate font-mono text-[11px] text-muted-foreground"
                      title={event.targetId}
                    >
                      {event.targetId}
                    </p>
                  ) : null}
                  <p
                    className="mt-1 max-w-72 truncate font-mono text-[11px] text-muted-foreground"
                    title={event.correlationId}
                  >
                    Reference {event.correlationId}
                  </p>
                </div>
                <p className="hidden truncate text-sm text-muted-foreground lg:block">
                  {event.actor?.name ?? "System"}
                </p>
                <div className="hidden min-w-0 lg:block">
                  {event.merchant ? (
                    <Link
                      className="truncate text-sm font-medium hover:text-primary"
                      href={`/tenants/${event.merchant.id}`}
                    >
                      {event.merchant.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Platform</span>
                  )}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </div>
            ))}
          </div>
          <OperationsPagination
            basePath="/audit"
            count={result.data.count}
            page={page}
            pageSize={limit}
            searchParams={{ category, ...filters }}
          />
        </>
      ) : (
        <Empty className="rounded-2xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileClock />
            </EmptyMedia>
            <EmptyTitle>
              {category || hasAuditFilters(filters)
                ? "No matching activity"
                : "No audit activity yet"}
            </EmptyTitle>
            <EmptyDescription>
              {category || hasAuditFilters(filters)
                ? "No recorded changes match the selected filters."
                : "Recorded platform changes will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
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
