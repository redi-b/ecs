export function getDashboardPublicHost() {
  return getHostname(process.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://dashboard.lvh.me");
}

export function isCentralDashboardHost(value: string | null | undefined) {
  const host = normalizeHost(value);

  return Boolean(host && host === getDashboardPublicHost());
}

export function normalizeHost(value: string | null | undefined) {
  return value?.split(":")[0]?.toLowerCase() ?? "";
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "dashboard.lvh.me";
  }
}
