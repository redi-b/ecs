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
      kind: "shop_not_found";
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

  if (result.status === 404 || result.message === "shop_not_found") {
    return {
      ok: false,
      kind: "shop_not_found",
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
    return "/dashboard";
  }

  const url = new URL(value, "https://dashboard.local");

  if (url.pathname !== "/dashboard" && !url.pathname.startsWith("/dashboard/")) {
    return "/dashboard";
  }

  if (
    url.pathname === "/sign-in" ||
    url.pathname.startsWith("/sign-in/") ||
    url.pathname === "/session" ||
    url.pathname.startsWith("/session/")
  ) {
    return "/dashboard";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getDashboardAuthRedirectPath(nextPath: string | null | undefined) {
  const next = getSafeDashboardPath(nextPath);

  if (next === "/dashboard") return "/sign-in";

  const params = new URLSearchParams({ next });
  return `/sign-in?${params.toString()}`;
}
