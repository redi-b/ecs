"use client";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AppLocale, getLocaleLabel, isAppLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { isLocalePending, locale, setLocale, t } = useI18n();

  async function changeLocale(nextLocale: string) {
    if (!isAppLocale(nextLocale) || nextLocale === locale || isLocalePending) {
      return;
    }

    await setLocale(nextLocale as AppLocale);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-busy={isLocalePending}
          aria-label={isLocalePending ? t("language.switching") : t("language.change")}
          className="min-w-9 tabular-nums"
          disabled={isLocalePending}
          size="icon-lg"
          variant="ghost"
        >
          {isLocalePending ? (
            <AppIcons.loader className="size-4 animate-spin" data-icon="inline-start" />
          ) : (
            <span aria-hidden="true" className="text-xs font-semibold uppercase">
              {locale}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => void changeLocale(value)}>
          <DropdownMenuRadioItem disabled={isLocalePending} value="en">
            <span>{getLocaleLabel("en")}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t("language.english")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem disabled={isLocalePending} value="am">
            <span lang="am">{getLocaleLabel("am")}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t("language.amharic")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {isLocalePending ? (
          <p
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground",
            )}
          >
            <AppIcons.loader className="size-3.5 animate-spin" />
            {t("language.switching")}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
