import assert from "node:assert/strict";
import test from "node:test";
import type { StorefrontLanguageSettings } from "@ecs/contracts";
import { localizeStorefrontNavigationHtml } from "./localized-navigation.js";

const settings: StorefrontLanguageSettings = {
  sourceLocale: "en",
  defaultLocale: "en",
  enabledLocales: ["en", "am"],
};

test("localizes storefront page links without touching actions, assets, or external links", () => {
  const html = localizeStorefrontNavigationHtml({
    html: '<a href="/">Home</a><a href="/products?q=coffee#list">Products</a><a href="/am/cart">Cart</a><a href="https://example.com">External</a><link href="/_astro/app.css"><form action="/actions/cart/add"></form>',
    locale: "am",
    settings,
  });
  assert.equal(
    html,
    '<a href="/am">Home</a><a href="/am/products?q=coffee#list">Products</a><a href="/am/cart">Cart</a><a href="https://example.com">External</a><link href="/_astro/app.css"><form action="/actions/cart/add"></form>',
  );
});

test("does not rewrite the default locale", () => {
  assert.equal(
    localizeStorefrontNavigationHtml({
      html: '<a href="/products">Products</a>',
      locale: "en",
      settings,
    }),
    '<a href="/products">Products</a>',
  );
});

test("keeps language switcher targets distinct on an Amharic page", () => {
  const html = localizeStorefrontNavigationHtml({
    html: '<a href="/" data-storefront-locale="en">EN</a><a href="/am" data-storefront-locale="am">አማ</a><a href="/products">Products</a>',
    locale: "am",
    settings,
  });
  assert.equal(
    html,
    '<a href="/" data-storefront-locale="en">EN</a><a href="/am" data-storefront-locale="am">አማ</a><a href="/am/products">Products</a>',
  );
});
