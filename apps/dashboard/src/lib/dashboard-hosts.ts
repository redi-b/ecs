const DEFAULT_DASHBOARD_URL = "http://app.lvh.me";
const DEFAULT_LEGACY_DASHBOARD_URL = "http://dashboard.lvh.me";

export function getDashboardPublicUrl() {
  return getUrl(process.env.DASHBOARD_PUBLIC_BASE_URL, DEFAULT_DASHBOARD_URL);
}

export function getDashboardPublicHost() {
  return getDashboardPublicUrl().hostname;
}

export function getLegacyDashboardPublicHost() {
  return getUrl(process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL, DEFAULT_LEGACY_DASHBOARD_URL)
    .hostname;
}

export function isCentralDashboardHost(value: string | null | undefined) {
  const host = normalizeHost(value);

  return Boolean(host && host === getDashboardPublicHost());
}

export function isLegacyCentralDashboardHost(value: string | null | undefined) {
  const host = normalizeHost(value);

  return Boolean(host && host === getLegacyDashboardPublicHost());
}

export function normalizeHost(value: string | null | undefined) {
  return value?.split(":")[0]?.toLowerCase() ?? "";
}

function getUrl(value: string | undefined, fallback: string) {
  try {
    return new URL(value ?? fallback);
  } catch {
    return new URL(fallback);
  }
}
