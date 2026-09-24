import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardAccessState } from "@/components/app/dashboard-access-state";
import Link from "@/components/app/link";
import { SignInForm } from "@/components/app/sign-in-form";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { GoogleAuthButton } from "@/components/onboarding/google-auth-button";
import type { MessageKey } from "@/i18n/messages";
import { getTranslations } from "@/i18n/server";
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getCentralDashboardUrl, type ShopHostValidation, validateShopHost } from "@/lib/shop-host";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string; reset?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const isCentralAccess = isCentralDashboardHost(requestHost);
  // Type as ShopHostValidation — do not use `as const` alone ({ ok: true } lacks `tenant`).
  const shopHost: ShopHostValidation =
    !isCentralAccess && requestHost
      ? await validateShopHost({ forwardedHost: requestHost })
      : { ok: true };

  if (!shopHost.ok) {
    if (shopHost.error === "shop_not_found") {
      return (
        <DashboardAccessState
          actionHref={getCentralDashboardUrl("/sign-in")}
          actionLabel={t("auth.shopMissing.cta")}
          description={t("auth.shopMissing.description")}
          title={t("auth.shopMissing.title")}
        />
      );
    }
    if (shopHost.error === "shop_unavailable") {
      return (
        <DashboardAccessState
          actionHref={getCentralDashboardUrl("/sign-in")}
          actionLabel={t("auth.shopMissing.cta")}
          description={t("auth.error.shopUnavailable")}
          title={t("auth.error.shopUnavailable")}
        />
      );
    }
  }

  const nextPath = getSafeNextPath(params?.next);
  const authenticatedRedirect = await getAuthenticatedDashboardRedirect({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost,
    nextPath,
  });

  if (authenticatedRedirect) {
    redirect(authenticatedRedirect);
  }

  const errorMessage = getErrorMessage(params?.error, t);
  const centralSignIn = getCentralDashboardUrl("/sign-in");
  const shopName =
    shopHost.ok && shopHost.tenant?.name?.trim() ? shopHost.tenant.name.trim() : null;

  return (
    <AuthShell>
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="type-page-title sm:text-[1.35rem]">{t("auth.signIn")}</h1>
          {shopName ? <p className="type-meta mt-1.5">{shopName}</p> : null}
        </div>
        {params?.verified === "1" ? (
          <p className="mb-5 rounded-lg border border-success/30 bg-success/8 px-3 py-2 text-sm text-success">
            {t("auth.emailVerified")}
          </p>
        ) : null}
        {params?.reset === "1" ? (
          <p className="mb-5 rounded-lg border border-success/30 bg-success/8 px-3 py-2 text-sm text-success">
            {t("auth.recovery.resetComplete")}
          </p>
        ) : null}
        {isCentralAccess && process.env.GOOGLE_CLIENT_ID?.trim() ? (
          <GoogleAuthButton nextPath={nextPath} />
        ) : null}
        <SignInForm errorMessage={errorMessage} nextPath={nextPath} />
        {isCentralAccess ? (
          <p className="mt-7 border-t border-border/80 pt-6 text-center text-sm text-muted-foreground">
            {t("auth.newMerchant")}{" "}
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href={`/sign-up${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              {t("auth.createAccount")}
            </Link>
          </p>
        ) : (
          <p className="mt-7 border-t border-border/80 pt-6 text-center text-sm text-muted-foreground">
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href={centralSignIn}
            >
              {t("auth.mainSignInLink")}
            </a>
          </p>
        )}
      </div>
    </AuthShell>
  );
}

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
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
    case "email_not_verified":
      return t("auth.error.emailNotVerified");
    case "access_denied":
    case "oauth_access_denied":
      return t("auth.error.socialSignInCancelled");
    case "account_not_linked":
    case "account_already_linked_to_different_user":
    case "unable_to_link_account":
      return t("auth.error.socialAccountConflict");
    case "social_sign_in_failed":
      return t("auth.error.socialSignInFailed");
    case "social_sign_in_unavailable":
      return t("auth.error.socialSignInUnavailable");
    case "auth_unavailable":
      return t("auth.error.unavailable");
    case "shop_not_found":
      return t("auth.error.shopNotFound");
    case "shop_unavailable":
      return t("auth.error.shopUnavailable");
    case "shop_access_denied":
      return t("auth.error.shopAccessDenied");
    default:
      return t("auth.error.failed");
  }
}
