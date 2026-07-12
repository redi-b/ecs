import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountSignUpForm } from "@/components/onboarding/account-signup-form";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

type SignUpPageProps = {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    ownerName?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const authenticatedRedirect = await getAuthenticatedDashboardRedirect({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
  });

  if (authenticatedRedirect) {
    redirect(authenticatedRedirect);
  }

  const isCentralAccess = isCentralDashboardHost(requestHost);

  if (!isCentralAccess) {
    redirect("/admin/sign-in");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessages: Record<string, string> = {
    auth_session_missing: t("signup.error.sessionMissing"),
    auth_unavailable: t("signup.error.unavailable"),
    email_already_exists: t("signup.error.emailExists"),
    missing_required_fields: t("signup.error.required"),
    password_too_short: t("signup.error.passwordShort"),
    signup_failed: t("signup.error.failed"),
  };
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ?? t("signup.error.failed"))
    : null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <AccountSignUpForm
          defaultValues={{
            email: resolvedSearchParams.email,
            ownerName: resolvedSearchParams.ownerName,
          }}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  );
}
