import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountSignUpForm } from "@/components/onboarding/account-signup-form";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { getTranslations } from "@/i18n/server";
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getSocialAuthProviders } from "@/lib/social-auth-providers";

type SignUpPageProps = {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    ownerName?: string;
    phone?: string;
    next?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const t = await getTranslations();
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const authenticatedRedirect = await getAuthenticatedDashboardRedirect({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
    nextPath,
  });

  if (authenticatedRedirect) {
    redirect(authenticatedRedirect);
  }

  const isCentralAccess = isCentralDashboardHost(requestHost);

  if (!isCentralAccess) {
    redirect("/sign-in");
  }

  const googleEnabled = (
    await getSocialAuthProviders(process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000")
  ).google;

  const errorMessages: Record<string, string> = {
    auth_session_missing: t("signup.error.sessionMissing"),
    auth_unavailable: t("signup.error.unavailable"),
    email_already_exists: t("signup.error.emailExists"),
    missing_required_fields: t("signup.error.required"),
    invalid_phone: t("signup.error.invalidPhone"),
    password_too_short: t("signup.error.passwordShort"),
    signup_failed: t("signup.error.failed"),
    social_sign_in_failed: t("auth.error.socialSignInFailed"),
    social_sign_in_unavailable: t("auth.error.socialSignInUnavailable"),
  };
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ?? t("signup.error.failed"))
    : null;

  return (
    <AuthShell>
      <AccountSignUpForm
        defaultValues={{
          email: resolvedSearchParams.email,
          ownerName: resolvedSearchParams.ownerName,
          phone: resolvedSearchParams.phone,
        }}
        errorMessage={errorMessage}
        googleEnabled={googleEnabled}
        nextPath={nextPath}
      />
    </AuthShell>
  );
}

function getSafeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/onboarding";
}
