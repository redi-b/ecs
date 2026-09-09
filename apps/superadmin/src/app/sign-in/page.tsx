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
    <main className="relative grid min-h-dvh place-items-center bg-background px-5 py-20">
      <div className="absolute right-5 top-5">
        <ThemeMenu />
      </div>
      <section className="operations-enter w-full max-w-[25rem]">
          <p className="text-sm font-medium">ECS Operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>

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

          <div className="mt-7">
            <OperatorSignInForm />
          </div>
      </section>
    </main>
  );
}
