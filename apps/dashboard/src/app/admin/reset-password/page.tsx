import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/app/account-recovery-forms";
import { AuthShell } from "@/components/onboarding/auth-shell";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
};

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
