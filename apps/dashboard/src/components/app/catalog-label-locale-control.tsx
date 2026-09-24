"use client";

import { AppIcons } from "@/components/app/icons";
import { useCatalogLabelLocale } from "@/components/providers/catalog-label-locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/provider";
import type { CatalogLabelLocaleMode } from "@/lib/catalog-label-locale";
import { cn } from "@/lib/utils";

const MODES: CatalogLabelLocaleMode[] = ["match", "en", "am"];

const MODE_COPY: Record<
  CatalogLabelLocaleMode,
  {
    hint:
      | "catalogLabels.control.followHint"
      | "catalogLabels.control.englishHint"
      | "catalogLabels.control.amharicHint";
    label:
      | "catalogLabels.control.follow"
      | "catalogLabels.control.english"
      | "catalogLabels.control.amharic";
  }
> = {
  match: { label: "catalogLabels.control.follow", hint: "catalogLabels.control.followHint" },
  en: { label: "catalogLabels.control.english", hint: "catalogLabels.control.englishHint" },
  am: { label: "catalogLabels.control.amharic", hint: "catalogLabels.control.amharicHint" },
};

export function CatalogLabelLocaleControl({ className }: { className?: string }) {
  const { t } = useI18n();
  const { amharicEnabled, mode, setMode } = useCatalogLabelLocale();

  if (!amharicEnabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("catalogLabels.control.trigger")}
          className={cn(className)}
          size="icon"
          type="button"
          variant="outline"
        >
          <AppIcons.translate />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("catalogLabels.control.legend")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            if (value === "match" || value === "en" || value === "am") setMode(value);
          }}
        >
          {MODES.map((option) => (
            <DropdownMenuRadioItem className="items-start py-2" key={option} value={option}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{t(MODE_COPY[option].label)}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t(MODE_COPY[option].hint)}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
