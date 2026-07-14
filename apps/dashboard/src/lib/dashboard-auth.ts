import type { MerchantDashboardAccess as MerchantDashboardAccessPayload } from "@ecs/contracts";

import type { MerchantDashboardAccessResult } from "@/lib/merchant-dashboard";

export const DASHBOARD_PATH_HEADER = "x-ecs-dashboard-path";

export type MerchantDashboardAccess =
  | {
      ok: true;
      access: MerchantDashboardAccessPayload;
    }
  | {
      ok: false;
      kind: "unauthenticated";
    }
  | {
      ok: false;
      kind: "forbidden";
      message: string;
    }
  | {
      ok: false;
      kind: "unavailable";
      message: string;
    };

export async function getMerchantDashboardAccess(options: {
  getAccess: () => Promise<MerchantDashboardAccessResult>;
}): Promise<MerchantDashboardAccess> {
  const result = await options.getAccess();

  if (result.ok) {
    return {
      ok: true,
      access: result.access,
    };
  }

  if (result.status === 401 || result.message === "auth_required") {
    return {
      ok: false,
      kind: "unauthenticated",
    };
  }

  if (result.status === 403 || result.message === "dashboard_forbidden") {
    return {
      ok: false,
      kind: "forbidden",
      message: result.message,
    };
  }

  return {
    ok: false,
    kind: "unavailable",
    message: result.message,
  };
}

export function getSafeDashboardPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  const url = new URL(value, "https://dashboard.local");

  if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) {
    return "/admin";
  }

  if (
    url.pathname === "/admin/sign-in" ||
    url.pathname.startsWith("/admin/sign-in/") ||
    url.pathname === "/admin/session" ||
    url.pathname.startsWith("/admin/session/")
  ) {
    return "/admin";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getDashboardAuthRedirectPath(nextPath: string | null | undefined) {
  const params = new URLSearchParams({
    next: getSafeDashboardPath(nextPath),
  });

  return `/admin/sign-in?${params.toString()}`;
}
