import {
  type MerchantOperationsDocumentKind,
  merchantOperationsDocumentKindSchema,
} from "@ecs/contracts";
import { headers } from "next/headers";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DocumentsTable } from "@/features/documents/documents-table";
import { getTranslations } from "@/i18n/server";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { getMerchantDocuments } from "@/lib/platform-api/documents";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type DocumentsPageProps = { searchParams?: Promise<DashboardSearchParams> };

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params: NonNullable<DashboardSearchParams> = (await searchParams) ?? {};
  const list = parseListSearchParams(params);
  const kind = getKind(params.kind);
  const from = getDate(params.from);
  const to = getDate(params.to);
  const requestHeaders = await headers();
  const result = await getMerchantDocuments({
    cookieHeader: requestHeaders.get("cookie"),
    ...(from ? { from } : {}),
    ...(kind !== "all" ? { kind } : {}),
    limit: list.pageSize,
    offset: (list.page - 1) * list.pageSize,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    ...(list.q ? { q: list.q } : {}),
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    ...(to ? { to } : {}),
  });
  const t = await getTranslations();

  return (
    <PageShell actions={<RefreshButton />} title={t("documents.title")}>
      {result.ok ? (
        <>
          <ListSummary
            count={result.data.count}
            filtered={Boolean(list.q || from || to || kind !== "all")}
            page={list.page}
            pageSize={result.data.limit}
          />
          <DocumentsTable
            documents={result.data.documents}
            footer={
              <PaginationControls
                basePath={dashboardRoutes.documents}
                count={result.data.count}
                page={list.page}
                pageSize={result.data.limit}
                searchParams={params}
              />
            }
            from={from}
            initialQuery={list.q}
            kind={kind}
            to={to}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("documents.loadFailed")}</AlertTitle>
          <AlertDescription>{t("documents.loadFailedHelp")}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function getKind(value: string | string[] | undefined): MerchantOperationsDocumentKind | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = merchantOperationsDocumentKindSchema.safeParse(candidate);
  return parsed.success ? parsed.data : "all";
}

function getDate(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}
