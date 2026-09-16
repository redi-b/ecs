import { headers } from "next/headers";

import { PaginationControls } from "@/components/app/list-page-controls";
import {
  parseMediaOrientation,
  parseMediaSize,
  parseMediaSort,
} from "@/features/media/media-helpers";
import { MediaWorkspace } from "@/features/media/media-workspace";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getMerchantMedia } from "@/lib/merchant-media";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MediaPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

const DEFAULT_MEDIA_PAGE_SIZE = 24;

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const mimeTypeRaw = Array.isArray(resolvedSearchParams.mimeType)
    ? resolvedSearchParams.mimeType[0]
    : resolvedSearchParams.mimeType;
  const mimeType = mimeTypeRaw?.trim() || undefined;
  const orientation = parseMediaOrientation(resolvedSearchParams.orientation);
  const size = parseMediaSize(resolvedSearchParams.size);
  const sort = parseMediaSort(resolvedSearchParams.sort);
  const pageSize = hasExplicitPageSize(resolvedSearchParams)
    ? listParams.pageSize
    : DEFAULT_MEDIA_PAGE_SIZE;
  const offset = (listParams.page - 1) * pageSize;
  const requestHeaders = await headers();
  const result = await getMerchantMedia(
    {
      cookieHeader: requestHeaders.get("cookie"),
      platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
      requestHost: requestHeaders.get("host"),
    },
    {
      limit: pageSize,
      offset,
      ...(listParams.q ? { query: listParams.q } : {}),
      ...(mimeType && mimeType !== "all" ? { mimeType } : {}),
      ...(orientation !== "all" ? { orientation } : {}),
      ...(size !== "all" ? { size } : {}),
      ...(sort !== "newest" ? { sort } : {}),
    },
  );

  const totalCount = result.ok ? result.data.count : 0;
  const assets = result.ok ? result.data.assets : [];
  const limit = result.ok ? result.data.limit : pageSize;

  return (
    <MediaWorkspace
      initialAssets={assets}
      initialError={result.ok ? undefined : result.error}
      initialMimeType={mimeType && mimeType !== "all" ? mimeType : "all"}
      initialOrientation={orientation}
      initialQuery={listParams.q}
      initialSize={size}
      initialSort={sort}
      page={listParams.page}
      pageSize={limit}
      totalCount={totalCount}
    >
      {result.ok ? (
        <PaginationControls
          basePath={dashboardRoutes.media}
          count={totalCount}
          page={listParams.page}
          pageSize={limit}
          searchParams={resolvedSearchParams}
        />
      ) : null}
    </MediaWorkspace>
  );
}

function hasExplicitPageSize(
  searchParams: NonNullable<DashboardSearchParams> | Record<string, never>,
) {
  const value = searchParams.pageSize;
  const candidate = Array.isArray(value) ? value[0] : value;
  return Boolean(candidate?.trim());
}
