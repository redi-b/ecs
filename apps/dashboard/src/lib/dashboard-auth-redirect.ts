import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { isPlatformOperatorSession } from "@/lib/platform-operator-session";
import { getLastShopId, resolveShopDestination } from "@/lib/shop-selection";

export async function getAuthenticatedDashboardRedirect(options: {
  cookieHeader?: string | null | undefined;
  platformApiBaseUrl: string;
  nextPath?: string | undefined;
  requestHost?: string | null | undefined;
}) {
  if (!options.cookieHeader?.trim()) {
    return null;
  }

  if (isCentralDashboardHost(options.requestHost)) {
    const operator = await isPlatformOperatorSession({
      cookieHeader: options.cookieHeader,
      platformApiBaseUrl: options.platformApiBaseUrl,
    });
    if (operator) {
      return process.env.SUPERADMIN_PUBLIC_BASE_URL ?? "http://ops.lvh.me";
    }

    const onboarding = await getPlatformOnboardingState({
      cookieHeader: options.cookieHeader,
      platformApiBaseUrl: options.platformApiBaseUrl,
    });

    if (!onboarding.ok) {
      return null;
    }

    if (!onboarding.state.user.phone) {
      const nextPath = getSafeNextPath(options.nextPath);
      return `/complete-account?next=${encodeURIComponent(nextPath)}`;
    }

    const nextPath = getSafeNextPath(options.nextPath);
    if (nextPath !== "/dashboard") return nextPath;

    return resolveShopDestination({
      lastShopId: getLastShopId(options.cookieHeader),
      protocol: new URL(process.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://app.lvh.me").protocol,
      state: onboarding.state,
    }).href;
  }

  const access = await getMerchantDashboardAccessShell({
    cookieHeader: options.cookieHeader,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
  });

  return access.ok ? "/dashboard" : null;
}

function getSafeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
