import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ThemeMenu } from "@/components/theme-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OperatorSignInForm } from "@/features/auth/operator-sign-in-form";
import { getOpsAccess } from "@/lib/ops-access";
import { getSafeReturnTo } from "@/lib/safe-return-to";

export default async function ReauthenticatePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; returnTo?: string }>;
}) {
  const access = await getOpsAccess();
  if (!access.ok && access.kind === "wrong_host") notFound();
  const params = await searchParams;
  const returnTo = getSafeReturnTo(params?.returnTo ?? null, "http://operations.local");
  if (!access.ok) redirect(`/sign-in?error=session_expired`);

  return (
    <main className="relative grid min-h-dvh place-items-center bg-muted/35 px-5 py-16">
      <div className="absolute right-5 top-5">
        <ThemeMenu />
      </div>
      <section className="operations-enter w-full max-w-md rounded-2xl border bg-card p-7 text-card-foreground shadow-sm sm:p-9">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck aria-hidden />
        </span>
        <p className="mt-7 text-sm font-medium text-primary">Security check</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Confirm it’s you</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter your password to continue with this protected action. You’re signed in as{" "}
          <span className="font-medium text-foreground">{access.operator.email}</span>.
        </p>

        {params?.error ? (
          <Alert className="mt-6" variant="destructive">
            <AlertTitle>We couldn’t confirm your password</AlertTitle>
            <AlertDescription>
              {params.error === "invalid_credentials"
                ? "Check your password and try again."
                : "Confirmation is temporarily unavailable. Try again in a moment."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-7">
          <OperatorSignInForm returnTo={returnTo} variant="reauthenticate" />
        </div>
        <Button asChild className="mt-3 w-full" variant="ghost">
          <Link href={returnTo}>
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Go back
          </Link>
        </Button>
      </section>
    </main>
  );
}
