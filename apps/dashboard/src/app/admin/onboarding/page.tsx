import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/onboarding/auth-shell";
import { ShopOnboardingForm } from "@/components/onboarding/signup-onboarding-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { getStorefrontTemplates } from "@/lib/storefront-templates";

type OnboardingPageProps = {
  searchParams?: Promise<{
    businessCategory?: string;
    contactPhone?: string;
    error?: string;
    handle?: string;
    shopName?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const requestHeaders = await headers();
  const isCentralAccess = isCentralDashboardHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  if (!isCentralAccess) {
    redirect("/admin/sign-in");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";

  if (!cookieHeader) {
    redirect("/admin/sign-in?next=%2Fadmin%2Fonboarding");
  }

  const [templatesResult, onboardingResult] = await Promise.all([
    getStorefrontTemplates({
      platformApiBaseUrl,
    }),
    getPlatformOnboardingState({
      cookieHeader,
      platformApiBaseUrl,
    }),
  ]);

  if (!onboardingResult.ok && onboardingResult.status === 401) {
    redirect("/admin/sign-in?next=%2Fadmin%2Fonboarding");
  }

  if (onboardingResult.ok && onboardingResult.state.primaryTenant) {
    redirect(onboardingResult.state.primaryTenant.dashboardUrl);
  }

  const templates = templatesResult.ok ? templatesResult.templates : [];
  const errorMessages: Record<string, string> = {
    auth_required: t("onboarding.error.authRequired"),
    handle_taken: t("onboarding.error.handleTaken"),
    invalid_shop_setup: t("onboarding.error.invalidSetup"),
    missing_required_fields: t("onboarding.error.required"),
    platform_request_failed: t("onboarding.error.platformUnavailable"),
    storefront_template_unavailable: t("onboarding.error.storefrontUnavailable"),
    template_unavailable: t("onboarding.error.templateUnavailable"),
    tenant_handle_taken: t("onboarding.error.handleTaken"),
  };
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ?? t("onboarding.error.failed"))
    : null;

  return (
    <AuthShell
      brandDescription={t("onboarding.description")}
      brandTitle={t("onboarding.title")}
      layout="setup"
    >
      {!templatesResult.ok ? (
        <Alert className="mb-6" variant="destructive">
          <AlertTitle>{t("onboarding.templatesUnavailable")}</AlertTitle>
          <AlertDescription>{templatesResult.message}</AlertDescription>
        </Alert>
      ) : null}

      <ShopOnboardingForm
        defaultValues={{
          businessCategory: resolvedSearchParams.businessCategory,
          contactPhone: resolvedSearchParams.contactPhone,
          handle: resolvedSearchParams.handle,
          shopName: resolvedSearchParams.shopName,
        }}
        errorMessage={errorMessage}
        storefrontBaseDomain={process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me"}
        templates={templates}
      />
    </AuthShell>
  );
}
