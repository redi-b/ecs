import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";

export async function getAuthenticatedDashboardRedirect(options: {
  cookieHeader?: string | null | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
}) {
  if (!options.cookieHeader?.trim()) {
    return null;
  }

  if (isCentralDashboardHost(options.requestHost)) {
    const onboarding = await getPlatformOnboardingState({
      cookieHeader: options.cookieHeader,
      platformApiBaseUrl: options.platformApiBaseUrl,
    });

    if (!onboarding.ok) {
      return null;
    }

    return onboarding.state.primaryTenant?.dashboardUrl ?? "/admin/onboarding";
  }

  const summary = await getMerchantDashboardSummary({
    cookieHeader: options.cookieHeader,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
  });

  return summary.ok ? "/admin" : null;
}
