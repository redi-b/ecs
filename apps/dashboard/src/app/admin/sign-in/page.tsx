import { headers } from "next/headers";
import Link from "@/components/app/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/app/sign-in-form";
import { AuthShell } from "@/components/onboarding/auth-shell";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
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
  const nextPath = getSafeNextPath(params?.next);
  const errorMessage = getErrorMessage(params?.error, t);

  return (
    <AuthShell
      brandDescription={
        isCentralAccess ? t("auth.centralBrandDescription") : t("auth.shopBrandDescription")
      }
      brandFooter={t("auth.brandFooter.signIn")}
      brandPoints={
        isCentralAccess
          ? [t("auth.brandPoint.catalog"), t("auth.brandPoint.orders"), t("auth.brandPoint.storefront")]
          : [t("auth.brandPoint.shopAccess"), t("auth.brandPoint.teamReady")]
      }
      brandTitle={isCentralAccess ? t("auth.centralBrandTitle") : t("auth.shopBrandTitle")}
    >
      <div className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <div className="mb-7">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {t("auth.merchantConsole")}
          </p>
          <h2 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-[1.35rem]">
            {t("auth.signIn")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isCentralAccess ? t("auth.centralDescription") : t("auth.shopDescription")}
          </p>
        </div>
        <SignInForm errorMessage={errorMessage} nextPath={nextPath} />
        {isCentralAccess ? (
          <p className="mt-7 border-t pt-6 text-center text-sm text-muted-foreground">
            {t("auth.newMerchant")}{" "}
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/admin/sign-up"
            >
              {t("auth.createAccount")}
            </Link>
          </p>
        ) : null}
      </div>
    </AuthShell>
  );
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}

function getErrorMessage(value: string | undefined, t: (key: MessageKey) => string) {
  if (!value) {
    return null;
  }

  switch (value) {
    case "missing_email":
      return t("auth.error.missingEmail");
    case "missing_password":
      return t("auth.error.missingPassword");
    case "invalid_credentials":
      return t("auth.error.invalidCredentials");
    case "auth_unavailable":
      return t("auth.error.unavailable");
    case "shop_not_found":
      return t("auth.error.shopNotFound");
    case "shop_unavailable":
      return t("auth.error.shopUnavailable");
    default:
      return t("auth.error.failed");
  }
}
