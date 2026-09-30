import type { MerchantExpenseCategory } from "@ecs/contracts";
import { headers } from "next/headers";
import { AppIcons } from "@/components/app/icons";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExpenseCreateDialog } from "@/features/expenses/expense-create-dialog";
import { ExpensesTable } from "@/features/expenses/expenses-table";
import { getTranslations } from "@/i18n/server";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { getMerchantExpenses } from "@/lib/platform-api/expenses";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

const categories: MerchantExpenseCategory[] = [
  "stock_supplies",
  "delivery_transport",
  "rent_utilities",
  "marketing",
  "fees",
  "wages",
  "tax",
  "other",
];

type ExpensesPageProps = { searchParams?: Promise<DashboardSearchParams> };

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params: NonNullable<DashboardSearchParams> = (await searchParams) ?? {};
  const list = parseListSearchParams(params);
  const category = getCategory(params.category);
  const status = list.status === "active" || list.status === "void" ? list.status : "all";
  const from = getDate(params.from);
  const to = getDate(params.to);
  const requestHeaders = await headers();
  const result = await getMerchantExpenses({
    ...(category !== "all" ? { category } : {}),
    cookieHeader: requestHeaders.get("cookie"),
    ...(from ? { from } : {}),
    limit: list.pageSize,
    offset: (list.page - 1) * list.pageSize,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    ...(list.q ? { q: list.q } : {}),
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    ...(status !== "all" ? { status } : {}),
    ...(to ? { to } : {}),
  });
  const t = await getTranslations();
  const filtered = Boolean(list.q || from || to || category !== "all" || status !== "all");

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <ExpenseCreateDialog />
        </>
      }
      title={t("expenses.title")}
    >
      {result.ok ? (
        <>
          <ListSummary
            actions={
              <Button asChild size="sm" variant="outline">
                <a href={expenseExportHref(params)}>
                  <AppIcons.download data-icon="inline-start" />
                  {t("expenses.export")}
                </a>
              </Button>
            }
            count={result.data.count}
            detail={`${t("expenses.activeTotal")}: ${formatEtb(result.data.totalAmount)}`}
            filtered={filtered}
            page={list.page}
            pageSize={result.data.limit}
          />
          <ExpensesTable
            category={category}
            expenses={result.data.expenses}
            footer={
              <PaginationControls
                basePath={dashboardRoutes.expenses}
                count={result.data.count}
                page={list.page}
                pageSize={result.data.limit}
                searchParams={params}
              />
            }
            from={from}
            initialQuery={list.q}
            status={status}
            to={to}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("expenses.loadFailed")}</AlertTitle>
          <AlertDescription>{t("expenses.loadFailedHelp")}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function getCategory(value: string | string[] | undefined): MerchantExpenseCategory | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  return categories.includes(candidate as MerchantExpenseCategory)
    ? (candidate as MerchantExpenseCategory)
    : "all";
}

function getDate(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}

function expenseExportHref(params: NonNullable<DashboardSearchParams>) {
  const query = new URLSearchParams();
  for (const key of ["q", "status", "category", "from", "to"] as const) {
    const value = params[key];
    const resolved = Array.isArray(value) ? value[0] : value;
    if (resolved) query.set(key, resolved);
  }
  const suffix = query.toString();
  return suffix
    ? `${dashboardRoutes.expensesExportAction}?${suffix}`
    : dashboardRoutes.expensesExportAction;
}

function formatEtb(minorAmount: number) {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(minorAmount / 100)} ETB`;
}
