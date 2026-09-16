import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { getSafeVerificationReturnPath } from "@/lib/platform-auth-account";

export default async function EmailVerificationResultPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; intent?: string; returnTo?: string }>;
}) {
  const t = await getTranslations();
  const params = await searchParams;
  const error = params?.error;
  const approvingChange = params?.intent === "approve-email-change";
  const returnTo = getResultReturnPath(params?.returnTo, approvingChange, Boolean(error));
  const unavailable = error === "VERIFICATION_UNAVAILABLE";
  const failed = Boolean(error);

  const title = failed
    ? unavailable
      ? t("auth.verificationFlow.unavailableTitle")
      : t("auth.verificationFlow.invalidTitle")
    : approvingChange
      ? t("auth.verificationFlow.approvedTitle")
      : t("auth.verificationFlow.verifiedTitle");
  const description = failed
    ? unavailable
      ? t("auth.verificationFlow.unavailableDescription")
      : t("auth.verificationFlow.invalidDescription")
    : approvingChange
      ? t("auth.verificationFlow.approvedDescription")
      : t("auth.verificationFlow.verifiedDescription");
  const Icon = failed ? AppIcons.error : AppIcons.check;

  return (
    <AuthShell>
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        <h1 className="mt-5 type-page-title sm:text-[1.35rem]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <Button asChild className="mt-6 h-11 w-full rounded-full">
          <Link href={returnTo}>
            {failed
              ? t("auth.verificationFlow.continue")
              : approvingChange
                ? t("auth.verificationFlow.accountSettings")
                : t("auth.verificationFlow.continue")}
          </Link>
        </Button>
      </section>
    </AuthShell>
  );
}

function getResultReturnPath(value: string | undefined, approvingChange: boolean, failed: boolean) {
  const path = getSafeVerificationReturnPath(value);
  if (!approvingChange && !failed) return path;
  const url = new URL(path, "https://dashboard.invalid");
  url.searchParams.delete("emailChanged");
  url.searchParams.delete("verified");
  return `${url.pathname}${url.search}`;
}
