/**
 * Parent cookie domain for prefs that must follow merchants across
 * dashboard.* and <shop>.* hosts (theme, locale).
 *
 * Prefer DASHBOARD_AUTH_COOKIE_DOMAIN (same as session cookies).
 * Fallback: drop the leftmost label of DASHBOARD_PUBLIC_BASE_URL or the request host
 * (dashboard.ecs.example.com → .ecs.example.com, not .example.com).
 */

export function getSharedParentCookieDomain(options?: {
  /** Client: current hostname */
  hostname?: string | null;
  /** Server env override (production) */
  authCookieDomain?: string | null;
  dashboardPublicBaseUrl?: string | null;
}): string | null {
  const fromEnv = (options?.authCookieDomain ?? process.env.DASHBOARD_AUTH_COOKIE_DOMAIN)?.trim();
  if (fromEnv) {
    return fromEnv.startsWith(".") ? fromEnv : `.${fromEnv}`;
  }

  const fromUrl = domainFromDashboardPublicUrl(
    options?.dashboardPublicBaseUrl ?? process.env.DASHBOARD_PUBLIC_BASE_URL,
  );
  if (fromUrl) {
    return fromUrl;
  }

  const hostname = options?.hostname?.split(":")[0]?.toLowerCase()?.trim();
  if (!hostname || hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return null;
  }

  return dropLeftmostLabel(hostname);
}

function domainFromDashboardPublicUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    return dropLeftmostLabel(new URL(value).hostname.toLowerCase());
  } catch {
    return null;
  }
}

/** dashboard.lvh.me → .lvh.me ; shop.ecs.example.com → .ecs.example.com */
function dropLeftmostLabel(hostname: string): string | null {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return `.${parts.slice(1).join(".")}`;
}
