import { ForgotPasswordForm } from "@/components/app/account-recovery-forms";
import { AuthShell } from "@/components/onboarding/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <ForgotPasswordForm />
      </section>
    </AuthShell>
  );
}
