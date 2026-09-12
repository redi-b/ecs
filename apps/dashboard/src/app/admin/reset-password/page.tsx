import { ResetPasswordForm } from "@/components/app/account-recovery-forms";
import { AuthShell } from "@/components/onboarding/auth-shell";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell>
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <ResetPasswordForm
          invalid={params?.error === "INVALID_TOKEN"}
          token={params?.token?.trim() || null}
        />
      </section>
    </AuthShell>
  );
}
