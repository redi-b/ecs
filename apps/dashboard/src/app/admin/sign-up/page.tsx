import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountSignUpForm } from "@/components/onboarding/account-signup-form";
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

type SignUpPageProps = {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    ownerName?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  auth_session_missing: "Account was created, but the session did not start. Sign in to continue.",
  auth_unavailable: "Signup is temporarily unavailable.",
  email_already_exists: "An account with that email already exists.",
  missing_required_fields: "Complete the required fields.",
  password_too_short: "Use at least 8 characters for the password.",
  signup_failed: "Signup could not be completed.",
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
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
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ?? "Signup failed. Please try again.")
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
