import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { getSafeAccountReturnPath } from "@/lib/platform-auth-account";

type VerificationIntent = "approve-email-change" | "verify-email";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string; returnTo?: string; token?: string }>;
}) {
  const t = await getTranslations();
  const params = await searchParams;
  const token = params?.token?.trim();
  const intent: VerificationIntent =
    params?.intent === "approve-email-change" ? "approve-email-change" : "verify-email";
  const returnTo = getSafeAccountReturnPath(params?.returnTo);
  const exitPath = getVerificationExitPath(returnTo);

  if (!token) {
    return (
      <AuthShell>
        <VerificationPanel
          action={
            <Button asChild className="w-full rounded-full">
              <Link href="/admin/sign-in">{t("auth.verificationFlow.backToSignIn")}</Link>
            </Button>
          }
          description={t("auth.verificationFlow.invalidDescription")}
          icon="error"
          title={t("auth.verificationFlow.invalidTitle")}
        />
      </AuthShell>
    );
  }

  const approvingChange = intent === "approve-email-change";
  return (
    <AuthShell>
      <VerificationPanel
        action={
          <form action="/admin/verify-email/confirm" className="space-y-3" method="post">
            <input name="intent" type="hidden" value={intent} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <input name="token" type="hidden" value={token} />
            <Button className="h-11 w-full rounded-full" type="submit">
              {approvingChange
                ? t("auth.verificationFlow.approveAction")
                : t("auth.verificationFlow.verifyAction")}
            </Button>
            <Button asChild className="h-11 w-full rounded-full" variant="outline">
              <Link href={exitPath}>{t("auth.verificationFlow.notNow")}</Link>
            </Button>
          </form>
        }
        description={
          approvingChange
            ? t("auth.verificationFlow.approveDescription")
            : t("auth.verificationFlow.verifyDescription")
        }
        icon="mail"
        title={
          approvingChange
            ? t("auth.verificationFlow.approveTitle")
            : t("auth.verificationFlow.verifyTitle")
        }
      />
    </AuthShell>
  );
}

function getVerificationExitPath(path: string) {
  const url = new URL(path, "https://dashboard.invalid");
  url.searchParams.delete("emailChanged");
  url.searchParams.delete("verified");
  return `${url.pathname}${url.search}`;
}

function VerificationPanel({
  action,
  description,
  icon,
  title,
}: {
  action: ReactNode;
  description: string;
  icon: "error" | "mail";
  title: string;
}) {
  const Icon = icon === "error" ? AppIcons.error : AppIcons.mail;
  return (
    <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <h1 className="mt-5 type-page-title sm:text-[1.35rem]">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6">{action}</div>
    </section>
  );
}
