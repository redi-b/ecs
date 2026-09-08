"use client";

import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function OnboardingSignOutButton() {
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await fetch("/admin/sign-out", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    window.location.assign("/admin/sign-in");
  }

  return (
    <Button
      aria-busy={isSigningOut}
      aria-label={isSigningOut ? t("account.signingOut") : t("account.signOut")}
      className="rounded-full px-2.5 sm:px-3"
      disabled={isSigningOut}
      onClick={() => void signOut()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {isSigningOut ? (
        <AppIcons.loader className="animate-spin" />
      ) : (
        <AppIcons.logout data-icon="inline-start" />
      )}
      <span className="hidden sm:inline">
        {isSigningOut ? t("account.signingOut") : t("account.signOut")}
      </span>
    </Button>
  );
}
