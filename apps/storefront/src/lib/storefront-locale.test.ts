import assert from "node:assert/strict";
import test from "node:test";
import type { StorefrontLanguageSettings } from "@ecs/contracts";
import {
  getStorefrontLocaleFromRequest,
  getStorefrontPreviewLocale,
  hasResolvedStorefrontLocale,
  localizeStorefrontPath,
  readStorefrontLocaleCookie,
  resolveStorefrontLocaleRoute,
} from "./storefront-locale.js";

const settings: StorefrontLanguageSettings = {
  sourceLocale: "en",
  defaultLocale: "en",
  enabledLocales: ["en", "am"],
};

test("reads the editor preview locale without accepting arbitrary values", () => {
  assert.equal(getStorefrontPreviewLocale(new URL("https://shop.example/preview?locale=am")), "am");
  assert.equal(getStorefrontPreviewLocale(new URL("https://shop.example/preview?locale=fr")), null);
});

test("recognizes a locale-resolved rewrite so middleware renders it only once", () => {
  assert.equal(hasResolvedStorefrontLocale(new Request("https://shop.example/")), false);
  assert.equal(
    hasResolvedStorefrontLocale(
      new Request("https://shop.example/", {
        headers: { "x-ecs-storefront-locale-resolved": "1" },
      }),
    ),
    true,
  );
});

test("keeps the shop default language on unprefixed canonical URLs", () => {
  assert.deepEqual(resolveStorefrontLocaleRoute({ pathname: "/products", settings }), {
    action: "render",
    locale: "en",
    pathname: "/products",
  });
  assert.equal(
    localizeStorefrontPath({ locale: "en", pathname: "/products", settings }),
    "/products",
  );
});

test("rewrites an enabled secondary language and removes a redundant default prefix", () => {
  assert.deepEqual(resolveStorefrontLocaleRoute({ pathname: "/am/products", settings }), {
    action: "render",
    locale: "am",
    pathname: "/products",
  });
  assert.deepEqual(resolveStorefrontLocaleRoute({ pathname: "/en/products", settings }), {
    action: "redirect",
    locale: "en",
    pathname: "/products",
  });
});

test("builds language switch links from a canonical path even when the input is localized", () => {
  assert.equal(
    localizeStorefrontPath({ locale: "en", pathname: "/am/products", settings }),
    "/products",
  );
  assert.equal(
    localizeStorefrontPath({ locale: "am", pathname: "/en/products", settings }),
    "/am/products",
  );
});

test("rejects disabled locale prefixes and parses the preference cookie safely", () => {
  const englishOnly: StorefrontLanguageSettings = { ...settings, enabledLocales: ["en"] };
  assert.deepEqual(
    resolveStorefrontLocaleRoute({ pathname: "/am/products", settings: englishOnly }),
    { action: "not_found" },
  );
  assert.equal(readStorefrontLocaleCookie("other=1; ecs_storefront_locale=am"), "am");
  assert.equal(readStorefrontLocaleCookie("ecs_storefront_locale=bogus"), null);
});

test("resolves action language from the initiating localized page", () => {
  const request = new Request("https://shop.example.com/actions/cart/add", {
    method: "POST",
    headers: { referer: "https://shop.example.com/am/products/shirt" },
  });
  assert.equal(getStorefrontLocaleFromRequest(request, settings), "am");
});

test("keeps an unprefixed action referrer in the default language", () => {
  const request = new Request("https://shop.example.com/actions/cart/add", {
    method: "POST",
    headers: {
      cookie: "ecs_storefront_locale=am",
      referer: "https://shop.example.com/products/shirt",
    },
  });
  assert.equal(getStorefrontLocaleFromRequest(request, settings), "en");
});

test("uses the saved preference only when an action has no same-origin referrer", () => {
  const request = new Request("https://shop.example.com/actions/cart/add", {
    method: "POST",
    headers: { cookie: "ecs_storefront_locale=am" },
  });
  assert.equal(getStorefrontLocaleFromRequest(request, settings), "am");
});
