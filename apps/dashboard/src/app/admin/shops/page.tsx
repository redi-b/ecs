import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppIcons } from "@/components/app/icons";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { OnboardingSignOutButton } from "@/components/onboarding/onboarding-sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getAllPlatformTenants } from "@/lib/platform-onboarding";
import { isPlatformOperatorSession } from "@/lib/platform-operator-session";
import { isAvailableShop } from "@/lib/shop-selection";

type ShopPickerPageProps = {
  searchParams?: Promise<{ current?: string; error?: string }>;
};

export default async function ShopPickerPage({ searchParams }: ShopPickerPageProps) {
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!isCentralDashboardHost(requestHost)) redirect("/admin");

  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) redirect("/admin/sign-in?next=%2Fadmin%2Fshops");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  if (await isPlatformOperatorSession({ cookieHeader, platformApiBaseUrl })) {
    redirect(process.env.SUPERADMIN_PUBLIC_BASE_URL ?? "http://ops.lvh.me");
  }

  const [t, result, params]: [
    Awaited<ReturnType<typeof getTranslations>>,
    Awaited<ReturnType<typeof getAllPlatformTenants>>,
    { current?: string; error?: string },
  ] = await Promise.all([
    getTranslations(),
    getAllPlatformTenants({ cookieHeader, platformApiBaseUrl }),
    searchParams ?? Promise.resolve({} as { current?: string; error?: string }),
  ]);
  if (!result.ok && result.status === 401) redirect("/admin/sign-in?next=%2Fadmin%2Fshops");
  const shops = result.ok ? result.tenants.filter(isAvailableShop) : [];
  if (result.ok && shops.length === 0) redirect("/admin/onboarding");

  return (
    <AuthShell
      brandDescription={t("onboarding.shopPicker.description")}
      brandTitle={t("onboarding.shopPicker.title")}
      layout="setup"
      toolbar={<OnboardingSignOutButton />}
    >
      {!result.ok || params.error ? (
        <Alert className="mb-5" variant="destructive">
          <AlertTitle>{t("onboarding.shopPicker.errorTitle")}</AlertTitle>
          <AlertDescription>{t("onboarding.shopPicker.errorDescription")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {shops.map((shop) => {
          const current = params.current === shop.id;
          return (
            <form
              action="/admin/shops/select"
              className="group rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-colors hover:border-foreground/20"
              key={shop.id}
              method="post"
            >
              <input name="tenantId" type="hidden" value={shop.id} />
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                  {(shop.name.charAt(0) || shop.handle.charAt(0)).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{shop.name}</h2>
                    {current ? (
                      <Badge variant="secondary">{t("onboarding.shopPicker.current")}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {shop.primaryDomain.hostname}
                  </p>
                  <p className="mt-2 text-xs capitalize text-muted-foreground">{shop.role}</p>
                </div>
                <Button
                  aria-label={t("onboarding.shopPicker.open", { shop: shop.name })}
                  size="icon-sm"
                  type="submit"
                  variant="ghost"
                >
                  <AppIcons.arrowRight />
                </Button>
              </div>
            </form>
          );
        })}
      </div>
    </AuthShell>
  );
}
