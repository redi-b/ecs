"use client";

import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function TelegramAuthButton({
  isLastUsed = false,
  nextPath,
}: {
  isLastUsed?: boolean;
  nextPath: string;
}) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const href = `/auth/telegram?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="relative mb-5">
      {isLastUsed ? (
        <span className="absolute -top-2 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-primary shadow-sm">
          <AppIcons.time className="size-3" aria-hidden />
          {t("auth.lastUsed")}
        </span>
      ) : null}
      <Button
        aria-busy={leaving}
        className="w-full"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          window.location.assign(href);
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        {leaving ? (
          <AppIcons.loader className="animate-spin" data-icon="inline-start" />
        ) : (
          <AppIcons.telegram data-icon="inline-start" />
        )}
        {t("auth.continueWithTelegram")}
      </Button>
    </div>
  );
}
