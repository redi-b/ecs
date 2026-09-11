import { headers } from "next/headers";

import Link from "@/components/app/link";
import { AuthShell } from "@/components/onboarding/auth-shell";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { platformFetch } from "@/lib/platform-api";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invitationId?: string; tenantId?: string }>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const t = await getTranslations();
  const invitationId = params.invitationId?.trim() ?? "";
  const tenantId = params.tenantId?.trim() ?? "";
  const sessionResponse = await platformFetch("/platform/auth/get-session", {
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL,
    requestHost: requestHeaders.get("host"),
  }).catch(() => null);
  const session = sessionResponse?.ok
    ? ((await sessionResponse.json().catch(() => null)) as {
        user?: { email?: string; name?: string };
      } | null)
    : null;
  const nextParams = new URLSearchParams({ invitationId });
  if (tenantId) nextParams.set("tenantId", tenantId);
  const next = `/accept-invitation?${nextParams.toString()}`;
  const errorMessage =
    params.error === "account"
      ? t("settings.team.wrongAccount")
      : params.error === "expired"
        ? t("settings.team.invitationExpired")
        : params.error === "verify"
          ? t("settings.team.verifyEmail")
          : t("settings.team.acceptFailed");

  return (
    <AuthShell>
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h1 className="type-page-title sm:text-[1.35rem]">{t("settings.team.acceptTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("settings.team.acceptDescription")}
        </p>
        {!invitationId ? (
          <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {t("settings.team.invalidInvitation")}
          </p>
        ) : params.error ? (
          <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {invitationId && session?.user ? (
          <div className="mt-6">
            <p className="mb-4 text-sm text-muted-foreground">
              {t("settings.team.acceptAs", { email: session.user.email ?? "" })}
            </p>
            <div className="grid gap-2">
              <form action="/accept-invitation/action" method="post">
                <input name="invitationId" type="hidden" value={invitationId} />
                {tenantId ? <input name="tenantId" type="hidden" value={tenantId} /> : null}
                <Button className="w-full rounded-full" type="submit">
                  {t("settings.team.accept")}
                </Button>
              </form>
              <form action="/admin/sign-out" method="post">
                <input
                  name="next"
                  type="hidden"
                  value={`/admin/sign-in?next=${encodeURIComponent(next)}`}
                />
                <Button className="w-full rounded-full" type="submit" variant="outline">
                  {t("settings.team.useAnotherAccount")}
                </Button>
              </form>
            </div>
          </div>
        ) : invitationId ? (
          <div className="mt-6 grid gap-2">
            <Button asChild className="w-full rounded-full">
              <Link href={`/admin/sign-in?next=${encodeURIComponent(next)}`}>
                {t("settings.team.signInToAccept")}
              </Link>
            </Button>
            <Button asChild className="w-full rounded-full" variant="outline">
              <Link href={`/admin/sign-up?next=${encodeURIComponent(next)}`}>
                {t("settings.team.createAccountToAccept")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
