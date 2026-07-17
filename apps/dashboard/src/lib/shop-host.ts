import { isCentralDashboardHost } from "./dashboard-hosts.js";

export type ShopHostValidation =
  | { ok: true }
  | { ok: false; error: "shop_not_found" | "shop_unavailable" | "auth_unavailable" };

/**
 * Public host probe (no session). Used before shop-host sign-in UI and on POST /admin/session.
 */
export async function validateShopHost(options: {
  forwardedHost: string;
  platformApiBaseUrl?: string;
  fetcher?: typeof fetch;
}): Promise<ShopHostValidation> {
  if (isCentralDashboardHost(options.forwardedHost)) {
    return { ok: true };
  }

  const fetcher = options.fetcher ?? fetch;
  const base = normalizeBaseUrl(options.platformApiBaseUrl ?? process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000");

  const response = await fetcher(new URL("/platform/merchant/host", base), {
    cache: "no-store",
    headers: {
      "x-forwarded-host": options.forwardedHost,
    },
  }).catch(() => null);

  if (!response) {
    return { ok: false, error: "auth_unavailable" };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error === "shop_not_found" ? "shop_not_found" : "shop_unavailable",
    };
  }

  return { ok: true };
}

/**
 * After credentials succeed, confirm this session is a member of the shop for this host.
 * Cookie header must be the Set-Cookie values from sign-in (name=value pairs).
 */
export async function sessionCanAccessShopHost(options: {
  cookieHeader: string;
  forwardedHost: string;
  platformApiBaseUrl?: string;
  fetcher?: typeof fetch;
}): Promise<boolean> {
  if (isCentralDashboardHost(options.forwardedHost)) {
    return true;
  }

  if (!options.cookieHeader.trim()) {
    return false;
  }

  const fetcher = options.fetcher ?? fetch;
  const base = normalizeBaseUrl(options.platformApiBaseUrl ?? process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000");

  const response = await fetcher(new URL("/platform/merchant/dashboard/access", base), {
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: options.cookieHeader,
      "x-forwarded-host": options.forwardedHost,
    },
  }).catch(() => null);

  return Boolean(response?.ok);
}

/** Absolute URL for the central merchant dashboard (sign-in / home). */
export function getCentralDashboardUrl(path = "/admin/sign-in") {
  const base = process.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://dashboard.lvh.me";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return new URL(relative, normalized).toString();
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
