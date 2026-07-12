"use client";

import Link from "@/components/app/link";
import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type PaginationItem = number | "ellipsis";

/** Build a compact page list: 1 … 4 5 6 … 20 */
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
  /** 1-based page index */
  page: number;
  totalPages: number;
  /** Client-side page change */
  onPageChange?: ((page: number) => void) | undefined;
  /** Server-side href builder (preferred when navigating with URL state) */
  getPageHref?: ((page: number) => string) | undefined;
  summary?: ReactNode;
};

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

  function renderControl({
    disabled,
    href,
    key,
    label,
    onClick,
    children,
    variant = "outline",
  }: {
    disabled: boolean;
    href?: string | undefined;
    key?: string | number | undefined;
    label: string;
    onClick?: (() => void) | undefined;
    children: ReactNode;
    variant?: "outline" | "default" | "ghost" | "secondary";
  }) {
    if (!disabled && href) {
      return (
        <Button asChild key={key} size="sm" variant={variant}>
          <Link aria-label={label} href={href}>
            {children}
          </Link>
        </Button>
      );
    }

    return (
      <Button
        aria-label={label}
        disabled={disabled}
        key={key}
        onClick={onClick}
        size="sm"
        type="button"
        variant={variant}
      >
        {children}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="text-sm text-muted-foreground">
        {summary ?? (
          <span>
            {t("common.pagination.pageOf" as any, {
              current: formatNumber(current),
              total: formatNumber(total),
            })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {renderControl({
          children: (
            <>
              <AppIcons.arrowLeft data-icon="inline-start" />
              <span className="max-sm:sr-only">{t("common.pagination.previous" as any)}</span>
            </>
          ),
          disabled: !canPrev,
          href: canPrev ? getPageHref?.(current - 1) : undefined,
          label: t("common.pagination.previousAria" as any),
          onClick: canPrev ? () => onPageChange?.(current - 1) : undefined,
        })}

        {items.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                aria-hidden
                className="grid h-7 min-w-7 place-items-center px-1 text-sm text-muted-foreground"
                key={`ellipsis-${index}`}
              >
                …
              </span>
            );
          }

          const isActive = item === current;
          if (isActive) {
            return (
              <Button
                aria-current="page"
                aria-label={t("common.pagination.pageAria" as any, { page: formatNumber(item) })}
                className="pointer-events-none"
                key={item}
                size="sm"
                type="button"
                variant="default"
              >
                {item}
              </Button>
            );
          }

          return renderControl({
            children: item,
            disabled: false,
            href: getPageHref?.(item),
            key: item,
            label: t("common.pagination.pageAria" as any, { page: formatNumber(item) }),
            onClick: () => onPageChange?.(item),
            variant: "outline",
          });
        })}

        {renderControl({
          children: (
            <>
              <span className="max-sm:sr-only">{t("common.pagination.next" as any)}</span>
              <AppIcons.arrowRight data-icon="inline-end" />
            </>
          ),
          disabled: !canNext,
          href: canNext ? getPageHref?.(current + 1) : undefined,
          label: t("common.pagination.nextAria" as any),
          onClick: canNext ? () => onPageChange?.(current + 1) : undefined,
        })}
      </div>
    </div>
  );
}
