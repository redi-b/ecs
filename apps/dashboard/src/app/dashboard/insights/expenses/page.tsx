import { headers } from "next/headers";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExpensesWorkspace } from "@/features/insights/expenses-workspace";
import { getTranslations } from "@/i18n/server";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { getMerchantExpenses } from "@/lib/platform-api/expenses";

export default async function ExpensesPage() {
  const requestHeaders = await headers();
  const t = await getTranslations();
  const result = await getMerchantExpenses({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  });
  return (
    <PageShell
      title={t("insights.expenses.title")}
      description={t("insights.expenses.description")}
      actions={
        result.ok ? (
          <Button asChild variant="outline">
            <a href="/dashboard/insights/expenses/export">{t("insights.expenses.export")}</a>
          </Button>
        ) : null
      }
    >
      {result.ok ? (
        <ExpensesWorkspace expenses={result.data.expenses} totalAmount={result.data.totalAmount} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("insights.expenses.loadFailed")}</AlertTitle>
          <AlertDescription>{t("insights.expenses.loadFailedHelp")}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
