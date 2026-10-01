import assert from "node:assert/strict";
import { test } from "node:test";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { messagesByLocale } from "@/i18n/messages";
import { SettingsSectionNav } from "./settings-section-nav";

for (const locale of ["en", "am"] as const) {
  test(`settings navigation renders localized, permission-filtered groups (${locale})`, () => {
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        {
          locale,
          messages: messagesByLocale[locale],
          timeZone: "Africa/Addis_Ababa",
        } as Parameters<typeof NextIntlClientProvider>[0],
        createElement(
          TooltipProvider,
          {} as Parameters<typeof TooltipProvider>[0],
          createElement(SettingsSectionNav, {
            active: "preferences",
            visibleSections: ["preferences", "account"],
            onSelect: () => undefined,
          }),
        ),
      ),
    );
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-current="page" data-section="preferences"/);
    assert.match(html, /data-section="account"/);
    assert.doesNotMatch(html, /data-section="domains"|data-section="team"/);
    assert.ok(html.includes(messagesByLocale[locale].settings.groups.account));
    assert.ok(!html.includes(messagesByLocale[locale].settings.groups.selling));
    assert.doesNotMatch(html, /settings\.groups\.|settings\.sections\./);
  });
}
