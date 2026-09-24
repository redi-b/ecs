import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogTranslationResourceQuerySchema,
  catalogTranslationUpdateSchema,
  emptyStorefrontLocalizedContent,
  storefrontCommerceLocale,
  storefrontLanguageSettingsSchema,
  storefrontLocalizedContentSchema,
  storefrontRouteLocale,
} from "./storefront-localization.js";

test("catalog translation requests require a parent product for nested resources", () => {
  assert.equal(
    catalogTranslationResourceQuerySchema.safeParse({
      resourceType: "product_option",
      resourceId: "opt_color",
      locale: "am",
    }).success,
    false,
  );
  assert.equal(
    catalogTranslationUpdateSchema.safeParse({
      resourceType: "product_option",
      resourceId: "opt_color",
      productId: "prod_1",
      locale: "am",
      translations: { title: "ቀለም" },
    }).success,
    true,
  );
  assert.equal(
    catalogTranslationUpdateSchema.safeParse({
      resourceType: "shipping_option",
      resourceId: "default",
      locale: "am",
      translations: { name: "መላኪያ" },
    }).success,
    true,
  );
});

test("storefront language settings require source and default languages to be enabled", () => {
  assert.equal(
    storefrontLanguageSettingsSchema.safeParse({
      sourceLocale: "en",
      defaultLocale: "am",
      enabledLocales: ["en"],
    }).success,
    false,
  );
  assert.equal(
    storefrontLanguageSettingsSchema.safeParse({
      sourceLocale: "en",
      defaultLocale: "am",
      enabledLocales: ["en", "am"],
    }).success,
    true,
  );
});

test("storefront language settings reject duplicate languages", () => {
  assert.equal(
    storefrontLanguageSettingsSchema.safeParse({
      sourceLocale: "en",
      defaultLocale: "en",
      enabledLocales: ["en", "en"],
    }).success,
    false,
  );
});

test("localized content stores stable fields with their source fingerprint", () => {
  assert.equal(storefrontLocalizedContentSchema.safeParse(emptyStorefrontLocalizedContent).success, true);
  assert.equal(
    storefrontLocalizedContentSchema.safeParse({
      version: 1,
      locales: {
        am: {
          "home.hero.title": {
            value: "የእርስዎ መደብር",
            sourceHash: "a".repeat(64),
          },
        },
      },
    }).success,
    true,
  );
});

test("route and commerce locale mappings are explicit and reversible", () => {
  assert.equal(storefrontCommerceLocale("en"), "en-ET");
  assert.equal(storefrontCommerceLocale("am"), "am-ET");
  assert.equal(storefrontRouteLocale("en-ET"), "en");
  assert.equal(storefrontRouteLocale("am-ET"), "am");
});
