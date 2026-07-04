import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";

type ListSummaryProps = {
  count: number;
  label: string;
};

type PaginationControlsProps = {
  basePath: string;
  count: number;
  page: number;
  pageSize: number;
  searchParams: DashboardSearchParams;
};

export function ListSummary({ count, label }: ListSummaryProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm">
      <span className="font-medium text-card-foreground">{count.toLocaleString()} total</span>
      <span className="text-muted-foreground">Showing merchant {label}</span>
    </div>
  );
}

export function PaginationControls({
  basePath,
  count,
  page,
  pageSize,
  searchParams,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={getPageHref(basePath, searchParams, previousPage)}>Previous</Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link href={getPageHref(basePath, searchParams, nextPage)}>Next</Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function getPageHref(basePath: string, searchParams: DashboardSearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "page" || key === "productStatus" || value === undefined) {
      continue;
    }

    const nextValue = Array.isArray(value) ? value[0] : value;

    if (nextValue !== undefined) {
      params.set(key, nextValue);
    }
  }

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}
