export type DashboardSearchParams = Record<string, string | string[] | undefined> | undefined;

export function getSelectedTenantId(searchParams: DashboardSearchParams) {
  const value = searchParams?.tenantId;
  const tenantId = Array.isArray(value) ? value[0] : value;
  // Chapa (and some browsers) may land with HTML-entity query strings: &amp;paid=1
  // or a corrupted tenantId value. Prefer a UUID when present.
  const cleaned = tenantId
    ?.trim()
    .replace(/&amp;/gi, "&")
    .split("&")[0]
    ?.trim();
  const uuid = cleaned?.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  )?.[0];

  return uuid || cleaned || undefined;
}

/** True when return_url set paid=1 (including broken &amp;paid=1 query keys). */
export function billingReturnPaidFlag(searchParams: DashboardSearchParams): boolean {
  const direct = searchParams?.paid;
  const paidRaw = Array.isArray(direct) ? direct[0] : direct;
  if (paidRaw === "1" || paidRaw === "true") return true;

  // Handle literal param name "amp;paid" from HTML-entity-encoded return URLs.
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (!key.replace(/^amp;/, "").includes("paid")) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === "1" || raw === "true") return true;
  }
  return false;
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
