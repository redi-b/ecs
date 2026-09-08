import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export default async function CheckEmailPage() {
  const t = await getTranslations();
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!isCentralDashboardHost(requestHost)) {
    redirect("/admin/sign-in");
  }

  return (
    <AuthShell>
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <AppIcons.mail className="size-5" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight sm:text-[1.35rem]">
          {t("signup.verification.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("signup.verification.description")}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("signup.verification.help")}
        </p>
        <Button asChild className="mt-6 w-full" variant="outline">
          <Link href="/admin/sign-in">{t("signup.verification.backToSignIn")}</Link>
        </Button>
      </section>
    </AuthShell>
  );
}
