"use client";

import Link from "@/components/app/link";
import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type PaginationItem = number | "ellipsis";

/** Compact page list: 1 … 4 5 6 … 20 */
export function getPaginationItems(page: number, totalPages: number): PaginationItem[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items: PaginationItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("ellipsis");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);

  return items;
}

type PaginationBarProps = {
  className?: string;
  page: number;
  totalPages: number;
  onPageChange?: ((page: number) => void) | undefined;
  getPageHref?: ((page: number) => string) | undefined;
  summary?: ReactNode;
};

const controlClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40";

export function PaginationBar({
  className,
  page,
  totalPages,
  onPageChange,
  getPageHref,
  summary,
}: PaginationBarProps) {
  const { t, formatNumber } = useI18n();
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);
  const items = getPaginationItems(current, total);
  const canPrev = current > 1;
  const canNext = current < total;

  function go(next: number) {
    if (next < 1 || next > total) return;
    onPageChange?.(next);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {summary ?? (
          <span>
            {t("common.pagination.pageOf", {
              current: formatNumber(current),
              total: formatNumber(total),
            })}
          </span>
        )}
      </p>

      <nav
        aria-label={t("common.pagination.pageOf", {
          current: formatNumber(current),
          total: formatNumber(total),
        })}
        className="flex items-center gap-1.5"
      >
        <PageControl
          ariaLabel={t("common.pagination.previousAria")}
          disabled={!canPrev}
          href={canPrev ? getPageHref?.(current - 1) : undefined}
          onClick={canPrev ? () => go(current - 1) : undefined}
        >
          <AppIcons.arrowLeft className="size-4" />
        </PageControl>

        <div className="flex items-center gap-0.5 rounded-full border bg-muted/30 p-0.5">
          {items.map((item, index) => {
            if (item === "ellipsis") {
              return (
                <span
                  aria-hidden
                  className="grid size-8 place-items-center text-xs text-muted-foreground"
                  key={`ellipsis-${index}`}
                >
                  …
                </span>
              );
            }

            const isActive = item === current;
            const label = t("common.pagination.pageAria", { page: formatNumber(item) });
            const href = getPageHref?.(item);

            if (isActive) {
              return (
                <span
                  aria-current="page"
                  aria-label={label}
                  className={cn(
                    controlClass,
                    "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
                  )}
                  key={item}
                >
                  {formatNumber(item)}
                </span>
              );
            }

            if (href) {
              return (
                <Link
                  aria-label={label}
                  className={cn(
                    controlClass,
                    "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                  href={href}
                  key={item}
                >
                  {formatNumber(item)}
                </Link>
              );
            }

            return (
              <button
                aria-label={label}
                className={cn(
                  controlClass,
                  "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
                key={item}
                onClick={() => go(item)}
                type="button"
              >
                {formatNumber(item)}
              </button>
            );
          })}
        </div>

        <PageControl
          ariaLabel={t("common.pagination.nextAria")}
          disabled={!canNext}
          href={canNext ? getPageHref?.(current + 1) : undefined}
          onClick={canNext ? () => go(current + 1) : undefined}
        >
          <AppIcons.arrowRight className="size-4" />
        </PageControl>
      </nav>
    </div>
  );
}

function PageControl({
  ariaLabel,
  children,
  disabled,
  href,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  if (!disabled && href) {
    return (
      <Link
        aria-label={ariaLabel}
        className={cn(
          controlClass,
          "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        href={href}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        controlClass,
        "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
