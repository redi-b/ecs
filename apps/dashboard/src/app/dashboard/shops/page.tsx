import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/onboarding/auth-shell";
import { OnboardingSignOutButton } from "@/components/onboarding/onboarding-sign-out-button";
import { ShopPickerOption } from "@/components/onboarding/shop-picker-option";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getTranslations } from "@/i18n/server";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getAllPlatformTenants } from "@/lib/platform-onboarding";
import { isPlatformOperatorSession } from "@/lib/platform-operator-session";
import { getShopDashboardUrl, isAvailableShop } from "@/lib/shop-selection";

type ShopPickerPageProps = {
  searchParams?: Promise<{ current?: string; error?: string }>;
};

export default async function ShopPickerPage({ searchParams }: ShopPickerPageProps) {
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!isCentralDashboardHost(requestHost)) redirect("/dashboard");

  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) redirect("/sign-in?next=%2Fadmin%2Fshops");
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
  if (!result.ok && result.status === 401) redirect("/sign-in?next=%2Fadmin%2Fshops");
  const shops = result.ok ? result.tenants.filter(isAvailableShop) : [];
  if (result.ok && shops.length === 0) redirect("/onboarding");
  if (result.ok && shops.length === 1 && shops[0]) {
    redirect(
      getShopDashboardUrl(
        shops[0].primaryDomain.hostname,
        requestHeaders.get("x-forwarded-proto") ?? "http",
      ),
    );
  }

  return (
    <AuthShell
      brandDescription={t("onboarding.shopPicker.description")}
      brandTitle={t("onboarding.shopPicker.title")}
      layout="setup"
      toolbar={<OnboardingSignOutButton confirm={false} />}
    >
      {!result.ok || params.error ? (
        <Alert className="mb-5" variant="destructive">
          <AlertTitle>{t("onboarding.shopPicker.errorTitle")}</AlertTitle>
          <AlertDescription>{t("onboarding.shopPicker.errorDescription")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        {shops.map((shop) => {
          const current = params.current === shop.id;
          return (
            <form
              action="/dashboard/shops/select"
              className="border-b border-border/70 last:border-b-0"
              key={shop.id}
              method="post"
            >
              <input name="tenantId" type="hidden" value={shop.id} />
              <ShopPickerOption
                current={current}
                currentLabel={t("onboarding.shopPicker.current")}
                domain={shop.primaryDomain.hostname}
                initial={(shop.name.charAt(0) || shop.handle.charAt(0)).toUpperCase()}
                name={shop.name}
                openLabel={t("onboarding.shopPicker.open", { shop: shop.name })}
                openingLabel={t("onboarding.shopPicker.opening")}
                role={shop.role}
              />
            </form>
          );
        })}
      </div>
    </AuthShell>
  );
}
