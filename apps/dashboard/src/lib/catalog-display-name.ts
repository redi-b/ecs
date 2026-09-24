import type { CatalogNameTranslation } from "@ecs/contracts";

import type { AppLocale } from "@/i18n/config";

export function catalogDisplayName(input: {
  displayLocale: AppLocale;
  source: string | null | undefined;
  translation?: CatalogNameTranslation | null | undefined;
  untitled: string;
}) {
  const source = input.source?.trim() || input.untitled;
  const translated = input.translation?.title?.trim() || null;
  const status = input.translation?.status ?? "using_english";
  const showTranslated = input.displayLocale === "am" && Boolean(translated);

  return {
    other: showTranslated ? source : translated,
    otherLang: showTranslated ? ("en" as const) : ("am" as const),
    primary: showTranslated ? translated! : source,
    status,
  };
}
