import assert from "node:assert/strict";
import { test } from "node:test";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messagesByLocale } from "@/i18n/messages";
import { ShopAddressFields } from "./shop-address-fields";
import { shopContactDraftSchema } from "./shop-contact-fields";

for (const locale of ["en", "am"] as const) {
  test(`manual shop address uses separately labeled shared controls (${locale})`, () => {
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        {
          locale,
          messages: messagesByLocale[locale],
          timeZone: "Africa/Addis_Ababa",
        } as Parameters<typeof NextIntlClientProvider>[0],
        createElement(ShopAddressFields, {
          value: {
            city: "Addis Ababa",
            streetAddress: "Example building",
            directions: "Side entrance",
            landmark: "Pharmacy",
            subcity: "Bole",
          },
          onChange: () => undefined,
          disabled: true,
        }),
      ),
    );
    assert.ok(html.includes(messagesByLocale[locale].onboarding.contact.city));
    assert.match(html, /value="Addis Ababa"/);
    assert.match(html, /Example building/);
    assert.match(html, /Side entrance/);
    assert.match(html, /value="Pharmacy"/);
    assert.match(html, /value="Bole"/);
    assert.match(html, /data-state="open"[^>]*data-slot="collapsible"/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /animate-collapsible-down/);
    assert.equal((html.match(/<(?:input|textarea)[^>]*disabled=""/g) ?? []).length, 8);
    assert.doesNotMatch(html, /<iframe|geoapify|maps\.google|onboarding\.contact\./);
  });
}

test("incomplete onboarding draft preserves every optional manual address field", () => {
  const address = {
    city: "Addis Ababa",
    region: "Addis Ababa",
    subcity: "Bole",
    woreda: "03",
    area: "Atlas",
    landmark: "Pharmacy",
    streetAddress: "Example building",
    directions: "Side entrance",
  };
  const draft = shopContactDraftSchema.parse({
    version: 1,
    categories: [],
    description: "",
    primaryPhone: "",
    additionalPhones: [],
    publicEmail: "",
    socialProfiles: [],
    address,
  });
  assert.deepEqual(draft.address, address);
});
