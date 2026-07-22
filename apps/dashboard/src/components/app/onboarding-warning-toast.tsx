"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n/provider";

const STORAGE_KEY = "ecs:onboarding-warning";

/**
 * Surfaces one-shot warnings after shop creation (e.g. delivery prefs failed
 * to apply). Reads sessionStorage and/or ?onboardingWarning= query.
 */
export function OnboardingWarningToast() {
  const { t } = useI18n();

  useEffect(() => {
    let warning: string | null = null;
    try {
      warning = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      warning = null;
    }

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("onboardingWarning");
    if (fromUrl) {
      warning = fromUrl;
    }

    if (warning === "delivery_prefs_not_applied") {
      toast.warning(t("onboarding.deliveryPrefsWarning"), { duration: 8000 });
    }

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    if (fromUrl) {
      params.delete("onboardingWarning");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  }, [t]);

  return null;
}
