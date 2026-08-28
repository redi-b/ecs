import { ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ThemeMenu } from "@/components/theme-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OperatorSignInForm } from "@/features/auth/operator-sign-in-form";
import { getOpsAccess } from "@/lib/ops-access";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const access = await getOpsAccess();
  if (access.ok) redirect("/");
  if (access.kind === "wrong_host") notFound();
  const error = (await searchParams)?.error;

  return (
    <main className="relative grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,0.68fr)]">
      <div className="absolute right-5 top-5 z-10 lg:right-7 lg:top-7">
        <ThemeMenu />
      </div>

      <section className="relative hidden overflow-hidden border-r bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.065] [background-image:linear-gradient(to_right,var(--sidebar-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--sidebar-foreground)_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <ShieldCheck aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">ECS Operations</p>
            <p className="text-xs text-sidebar-foreground/60">Platform workspace</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            ECS Operations
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            Keep merchant operations moving.
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-sidebar-foreground/68">
            Review merchant accounts, resolve issues, and manage platform work from one secure
            workspace.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/45">For authorized ECS operators</p>
      </section>

      <section className="flex items-center justify-center px-5 py-20 sm:px-10 lg:px-14">
        <div className="operations-enter w-full max-w-[25rem]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden />
            </span>
            <span className="text-sm font-semibold">ECS Operations</span>
          </div>

          <p className="text-sm font-medium text-primary">ECS Operations</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Sign in</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use your ECS operations account.
          </p>

          {error ? (
            <Alert className="mt-6" variant="destructive">
              <AlertTitle>We couldn’t sign you in</AlertTitle>
              <AlertDescription>
                {error === "invalid_credentials"
                  ? "Check your email and password, then try again."
                  : "Sign-in is temporarily unavailable. Try again in a moment."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-8">
            <OperatorSignInForm />
          </div>
        </div>
      </section>
    </main>
  );
}
