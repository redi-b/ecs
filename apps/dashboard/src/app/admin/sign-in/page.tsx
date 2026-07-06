import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { getAuthenticatedDashboardRedirect } from "@/lib/dashboard-auth-redirect";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
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
  const errorMessage = getErrorMessage(params?.error);

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <Card className="w-full rounded-3xl border border-border/70 bg-card/95 shadow-xl shadow-primary/5 backdrop-blur [--card-spacing:--spacing(5)]">
          <CardHeader className="gap-1.5">
            <div className="text-xs font-bold tracking-normal text-muted-foreground uppercase">
              Merchant console
            </div>
            <CardTitle className="text-xl font-semibold">Sign in</CardTitle>
            <CardDescription>
              {isCentralAccess
                ? "Sign in to continue to your shops."
                : "Use an email that belongs to this shop."}
            </CardDescription>
            <CardAction>
              <ThemeToggle />
            </CardAction>
          </CardHeader>
          <CardContent className="pt-1">
            <SignInForm errorMessage={errorMessage} nextPath={nextPath} />
            {isCentralAccess ? (
              <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
                New merchant?{" "}
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href="/admin/sign-up"
                >
                  Create an account
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

function getErrorMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  switch (value) {
    case "missing_email":
      return "Enter an email address.";
    case "missing_password":
      return "Enter a password.";
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "auth_unavailable":
      return "Sign-in is temporarily unavailable.";
    case "shop_not_found":
      return "This shop address is not active.";
    case "shop_unavailable":
      return "This shop is not ready for dashboard access.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
