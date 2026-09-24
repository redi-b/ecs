import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountCompletionForm } from "@/components/onboarding/account-completion-form";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { OnboardingSignOutButton } from "@/components/onboarding/onboarding-sign-out-button";
import { getSafeAccountCompletionPath } from "@/lib/account-completion";
import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getAccountIdentity } from "@/lib/platform-auth-account";

type CompleteAccountPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function CompleteAccountPage({ searchParams }: CompleteAccountPageProps) {
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!isCentralDashboardHost(requestHost)) redirect("/sign-in");

  const nextPath = getSafeAccountCompletionPath((await searchParams)?.next);
  const identity = await getAccountIdentity(await getAccountAuthRequestContext());
  if (!identity.ok) {
    redirect(`/sign-in?next=${encodeURIComponent(`/complete-account?next=${nextPath}`)}`);
  }
  if (identity.phone) redirect(nextPath);

  return (
    <AuthShell toolbar={<OnboardingSignOutButton />}>
      <AccountCompletionForm nextPath={nextPath} />
    </AuthShell>
  );
}
