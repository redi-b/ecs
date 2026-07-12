import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { SignInForm } from "@/components/app/sign-in-form";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <Card className="w-full rounded-3xl border border-border bg-card [--card-spacing:--spacing(5)]">
          <CardHeader className="gap-1.5">
            <div className="text-xs font-bold tracking-normal text-muted-foreground uppercase">
              {t("auth.merchantConsole")}
            </div>
            <CardTitle className="text-xl font-semibold">{t("auth.signIn")}</CardTitle>
            <CardDescription>
              {isCentralAccess ? t("auth.centralDescription") : t("auth.shopDescription")}
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-1">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-1">
            <SignInForm errorMessage={errorMessage} nextPath={nextPath} />
            {isCentralAccess ? (
              <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
                {t("auth.newMerchant")}{" "}
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href="/admin/sign-up"
                >
                  {t("auth.createAccount")}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
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
