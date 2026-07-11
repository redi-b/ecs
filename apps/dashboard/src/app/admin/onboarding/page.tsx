import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { ShopOnboardingForm } from "@/components/onboarding/signup-onboarding-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { getPlatformOnboardingState } from "@/lib/platform-onboarding";
import { getStorefrontTemplates } from "@/lib/storefront-templates";

type OnboardingPageProps = {
  searchParams?: Promise<{
    businessCategory?: string;
    contactPhone?: string;
    error?: string;
    handle?: string;
    shopName?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  auth_required: "Sign in before setting up a shop.",
  handle_taken: "That shop address is already taken.",
  invalid_shop_setup: "Check the shop details and try again.",
  missing_required_fields: "Complete the required fields.",
  platform_request_failed: "The platform service could not be reached.",
  storefront_template_unavailable: "No storefront template is available right now.",
  template_unavailable: "Selected storefront is unavailable.",
  tenant_handle_taken: "That shop address is already taken.",
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const requestHeaders = await headers();
  const isCentralAccess = isCentralDashboardHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  if (!isCentralAccess) {
    redirect("/admin/sign-in");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";

  if (!cookieHeader) {
    redirect("/admin/sign-in?next=%2Fadmin%2Fonboarding");
  }

  const [templatesResult, onboardingResult] = await Promise.all([
    getStorefrontTemplates({
      platformApiBaseUrl,
    }),
    getPlatformOnboardingState({
      cookieHeader,
      platformApiBaseUrl,
    }),
  ]);

  if (!onboardingResult.ok && onboardingResult.status === 401) {
    redirect("/admin/sign-in?next=%2Fadmin%2Fonboarding");
  }

  if (onboardingResult.ok && onboardingResult.state.primaryTenant) {
    redirect(onboardingResult.state.primaryTenant.dashboardUrl);
  }

  const templates = templatesResult.ok ? templatesResult.templates : [];
  const errorMessage = resolvedSearchParams.error
    ? (errorMessages[resolvedSearchParams.error] ?? "Shop setup failed. Please try again.")
    : null;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="grid gap-3 border-b pb-5 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="text-sm font-medium text-primary">Merchant onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Configure your first shop
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your account is ready. Add the shop details and choose a storefront starting point.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {!templatesResult.ok ? (
          <Alert variant="destructive">
            <AlertTitle>Storefront templates unavailable</AlertTitle>
            <AlertDescription>{templatesResult.message}</AlertDescription>
          </Alert>
        ) : null}

        <ShopOnboardingForm
          defaultValues={{
            businessCategory: resolvedSearchParams.businessCategory,
            contactPhone: resolvedSearchParams.contactPhone,
            handle: resolvedSearchParams.handle,
            shopName: resolvedSearchParams.shopName,
          }}
          errorMessage={errorMessage}
          storefrontBaseDomain={process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me"}
          templates={templates}
        />
      </div>
    </main>
  );
}
