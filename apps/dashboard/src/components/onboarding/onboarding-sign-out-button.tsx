"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function OnboardingSignOutButton({ confirm = true }: { confirm?: boolean }) {
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const response = await fetch("/sign-out", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    window.location.assign(data?.redirectTo ?? "/sign-in");
  }

  const trigger = (
    <Button
      aria-busy={isSigningOut}
      aria-label={isSigningOut ? t("account.signingOut") : t("account.signOut")}
      className="min-w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      disabled={isSigningOut}
      onClick={confirm ? undefined : () => void signOut()}
      size="icon-lg"
      type="button"
      variant="ghost"
    >
      {isSigningOut ? <AppIcons.loader className="animate-spin" /> : <AppIcons.logout />}
    </Button>
  );

  if (!confirm) return trigger;

  return (
    <ConfirmDialog
      cancelDisabled={isSigningOut}
      confirmDisabled={isSigningOut}
      confirmLabel={isSigningOut ? t("account.signingOut") : t("account.signOut")}
      description={t("onboarding.signOutDescription")}
      icon="logout"
      onConfirm={() => void signOut()}
      title={t("onboarding.signOutTitle")}
      trigger={trigger}
    />
  );
}
