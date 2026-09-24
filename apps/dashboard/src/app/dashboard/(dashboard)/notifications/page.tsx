import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { NotificationHistory } from "@/features/notifications/notification-history";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { listInAppNotifications } from "@/lib/platform-api/notifications/inbox-client";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const list = parseListSearchParams(params);
  const t = await getTranslations();
  const requestHeaders = await headers();
  const unreadOnly = params.view === "unread";
  const category = parseCategory(params.category);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const tenantId = getSelectedTenantId(params);
  const common = {
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    ...(tenantId ? { tenantId } : {}),
  };
  const result = await listInAppNotifications({
    ...common,
    ...(category ? { category } : {}),
    limit: list.pageSize,
    offset: (list.page - 1) * list.pageSize,
    ...(q ? { q } : {}),
    unreadOnly,
  });

  return (
    <PageShell title={t("common.inbox.title")} actions={<RefreshButton />}>
      {result.ok ? (
        <>
          <ListSummary
            count={result.count}
            filtered={Boolean(q || category || unreadOnly)}
            page={list.page}
            pageSize={list.pageSize}
          />
          <NotificationHistory
            category={category ?? "all"}
            initialResult={result}
            query={q}
            unreadOnly={unreadOnly}
          />
          <PaginationControls
            basePath={dashboardRoutes.notifications}
            count={result.count}
            page={list.page}
            pageSize={list.pageSize}
            searchParams={params}
          />
        </>
      ) : (
        <NotificationHistory
          category={category ?? "all"}
          initialResult={result}
          query={q}
          unreadOnly={unreadOnly}
        />
      )}
    </PageShell>
  );
}

function parseCategory(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ["billing", "inquiries", "inventory", "orders", "system"].includes(
    typeof candidate === "string" ? candidate : "",
  )
    ? (candidate as "billing" | "inquiries" | "inventory" | "orders" | "system")
    : undefined;
}
