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
    <div className="mb-5">
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
        {isLastUsed ? (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {t("auth.lastUsed")}
          </span>
        ) : null}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {t("auth.telegramMessagesHint")}
      </p>
    </div>
  );
}
