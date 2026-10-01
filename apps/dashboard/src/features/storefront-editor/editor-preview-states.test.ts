import assert from "node:assert/strict";
import { test } from "node:test";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messagesByLocale } from "@/i18n/messages";
import { TemplatePreview } from "./editor-preview";

for (const locale of ["en", "am"] as const) {
  for (const templateKey of ["nexahub@1", "missing-template@1"]) {
    test(`preview fallback is localized without internal template details (${locale}, ${templateKey})`, () => {
      const html = renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          {
            locale,
            messages: messagesByLocale[locale],
            timeZone: "Africa/Addis_Ababa",
          } as Parameters<typeof NextIntlClientProvider>[0],
          createElement(TemplatePreview, {
            templateKey,
            storefrontName: "Example shop",
            props: {} as Parameters<typeof TemplatePreview>[0]["props"],
          }),
        ),
      );
      const messages = messagesByLocale[locale].editor.preview;
      assert.ok(
        html.includes(
          templateKey === "nexahub@1" ? messages.unavailableTitle : messages.unsupportedTitle,
        ),
      );
      assert.doesNotMatch(
        html,
        /signed preview|preview services|nexahub@1|missing-template@1|editor\.preview\./,
      );
      assert.doesNotMatch(html, /<iframe|<button/);
    });
  }
}
