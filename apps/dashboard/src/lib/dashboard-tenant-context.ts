export type DashboardSearchParams = Record<string, string | string[] | undefined> | undefined;

export function getSelectedTenantId(searchParams: DashboardSearchParams) {
  const value = searchParams?.tenantId;
  const tenantId = Array.isArray(value) ? value[0] : value;
  const trimmed = tenantId?.trim();

  return trimmed || undefined;
}

export function getTenantScopedPath(path: string, tenantId: string | null | undefined) {
  const trimmedTenantId = tenantId?.trim();

  if (!trimmedTenantId) {
    return path;
  }

  const url = new URL(path, "http://dashboard.local");
  url.searchParams.set("tenantId", trimmedTenantId);

  return `${url.pathname}${url.search}`;
}

export function appendTenantRedirectParams(url: URL, request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId")?.trim();

  if (tenantId) {
    url.searchParams.set("tenantId", tenantId);
  }
}
