"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AppLocale, getLocaleLabel } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);

  async function changeLocale(nextLocale: string) {
    if (nextLocale === locale || (nextLocale !== "en" && nextLocale !== "am")) {
      return;
    }

    setPendingLocale(nextLocale);
    const response = await fetch("/admin/locale", {
      body: JSON.stringify({ locale: nextLocale }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);

    if (response?.ok) {
      window.location.reload();
      return;
    }

    setPendingLocale(null);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("language.change")}
          className="min-w-9 tabular-nums"
          disabled={pendingLocale !== null}
          size="icon-lg"
          variant="ghost"
        >
          <span aria-hidden="true" className="text-xs font-semibold uppercase">
            {locale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          <DropdownMenuRadioItem value="en">
            <span>{getLocaleLabel("en")}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t("language.english")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="am">
            <span lang="am">{getLocaleLabel("am")}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t("language.amharic")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
