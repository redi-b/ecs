"use client";

import type { MerchantExpense, MerchantExpenseCategory } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { type DataTableFilter, DataTableFilters } from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import type { ResourceRowActions } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { dashboardRoutes } from "@/lib/routes";
import { expenseCategories } from "./expense-create-dialog";

type ExpenseStatus = "active" | "void" | "all";

export function ExpensesTable({
  category,
  expenses,
  footer,
  from,
  initialQuery,
  status,
  to,
}: {
  category: MerchantExpenseCategory | "all";
  expenses: MerchantExpense[];
  footer?: ReactNode;
  from: string;
  initialQuery: string;
  status: ExpenseStatus;
  to: string;
}) {
  const { formatDate, formatNumber, t } = useI18n();
  const canManage = usePermission("settings.manage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [voiding, setVoiding] = useState<MerchantExpense | null>(null);
  const [voidPending, setVoidPending] = useState(false);

  const pushFilters = useCallback(
    (
      next: Partial<{
        q: string;
        category: MerchantExpenseCategory | "all";
        status: ExpenseStatus;
        from: string;
        to: string;
      }>,
    ) => {
      const values = {
        category,
        from,
        q: initialQuery,
        status,
        to,
        ...next,
      };
      const url = new URL(window.location.href);
      setParam(url, "q", values.q, "");
      setParam(url, "category", values.category, "all");
      setParam(url, "status", values.status, "all");
      setParam(url, "from", values.from, "");
      setParam(url, "to", values.to, "");
      url.searchParams.delete("page");
      startTransition(() => router.push(`${url.pathname}?${url.searchParams.toString()}`));
    },
    [category, from, initialQuery, router, status, to],
  );

  const clearFilters = useCallback(() => {
    setSearchValue("");
    const url = new URL(window.location.href);
    for (const key of ["q", "category", "status", "from", "to", "page"]) {
      url.searchParams.delete(key);
    }
    startTransition(() => router.push(url.pathname));
  }, [router]);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        defaultValue: "all",
        id: "status",
        label: t("expenses.filter.status"),
        onChange: (value) => pushFilters({ status: value as ExpenseStatus }),
        options: [
          { label: t("expenses.filter.allStatuses"), value: "all" },
          { label: t("expenses.active"), value: "active" },
          { label: t("expenses.voided"), value: "void" },
        ],
        value: status,
      },
      {
        defaultValue: "all",
        id: "category",
        label: t("expenses.filter.category"),
        onChange: (value) => pushFilters({ category: value as MerchantExpenseCategory | "all" }),
        options: [
          { label: t("expenses.filter.allCategories"), value: "all" },
          ...expenseCategories.map((value) => ({
            label: t(`expenses.categories.${value}`),
            value,
          })),
        ],
        value: category,
      },
      {
        id: "date",
        kind: "date",
        label: t("expenses.filter.date"),
        onChange: (value) =>
          pushFilters({
            from: value?.kind === "range" ? value.start : "",
            to: value?.kind === "range" ? value.end : "",
          }),
        options: [],
        value: from && to ? { end: to, kind: "range", start: from } : null,
      },
    ],
    [category, from, pushFilters, status, t, to],
  );

  const columns = useMemo<ColumnDef<MerchantExpense>[]>(
    () => [
      {
        accessorKey: "occurredOn",
        header: t("expenses.date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.occurredOn)}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: t("expenses.category"),
        cell: ({ row }) => t(`expenses.categories.${row.original.category}`),
      },
      {
        id: "details",
        header: t("expenses.details"),
        cell: ({ row }) => (
          <div className="max-w-80">
            <p className="truncate font-medium">{row.original.vendorLabel || "—"}</p>
            {row.original.reference || row.original.note ? (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.reference || row.original.note}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("expenses.status"),
        cell: ({ row }) => (
          <Badge variant={row.original.status === "active" ? "secondary" : "outline"}>
            {row.original.status === "active" ? t("expenses.active") : t("expenses.voided")}
          </Badge>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <span className="block text-right">{t("expenses.amount")}</span>,
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right font-mono tabular-nums">
            {formatNumber(row.original.amount / 100, {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}{" "}
            ETB
          </span>
        ),
      },
    ],
    [formatDate, formatNumber, t],
  );

  const rowActions = useCallback(
    (expense: MerchantExpense): ResourceRowActions | null =>
      canManage && expense.status === "active"
        ? {
            actions: [
              {
                icon: AppIcons.close,
                label: t("expenses.void.action"),
                onSelect: () => setVoiding(expense),
                type: "button",
                variant: "destructive",
              },
            ],
            label: t("expenses.rowActions"),
          }
        : null,
    [canManage, t],
  );

  async function voidExpense() {
    if (!voiding) return;
    setVoidPending(true);
    const response = await fetch(dashboardRoutes.expenseVoidAction(voiding.id), {
      headers: { "idempotency-key": createClientId("expense-void") },
      method: "POST",
    }).catch(() => null);
    setVoidPending(false);
    if (!response?.ok) {
      toast.error(t("expenses.toast.voidFailed"));
      return;
    }
    toast.success(t("expenses.toast.voided"));
    setVoiding(null);
    router.refresh();
  }

  const filtered = Boolean(initialQuery || from || to || category !== "all" || status !== "all");

  return (
    <>
      <DataTable
        columns={columns}
        data={expenses}
        emptyIcon={<AppIcons.wallet aria-hidden className="size-8" />}
        emptyMessage={t("expenses.emptyMessage")}
        emptyTitle={t("expenses.emptyTitle")}
        enableSorting={false}
        filteredEmptyMessage={t("expenses.filteredEmptyMessage")}
        filteredEmptyTitle={t("expenses.filteredEmptyTitle")}
        footer={footer}
        getRowId={(expense) => expense.id}
        isFiltered={filtered}
        isLoading={pending}
        rowActions={rowActions}
        toolbar={
          <DataTableFilters filters={filters} onClearAll={clearFilters}>
            <ListToolbarSearch
              clearLabel={t("common.clearSearch")}
              label={t("expenses.searchLabel")}
              onChange={(value) => {
                setSearchValue(value);
                pushFilters({ q: value });
              }}
              placeholder={t("expenses.searchPlaceholder")}
              value={searchValue}
            />
          </DataTableFilters>
        }
      />
      <ConfirmDialog
        confirmDisabled={voidPending}
        confirmLabel={t("expenses.void.confirm")}
        description={t("expenses.void.description")}
        onConfirm={() => void voidExpense()}
        onOpenChange={(open) => {
          if (!open && !voidPending) setVoiding(null);
        }}
        open={Boolean(voiding)}
        title={t("expenses.void.title")}
      />
    </>
  );
}

function setParam(url: URL, key: string, value: string, defaultValue: string) {
  if (value && value !== defaultValue) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
}
