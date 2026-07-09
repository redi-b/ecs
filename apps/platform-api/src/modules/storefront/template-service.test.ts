import assert from "node:assert/strict";
import test from "node:test";

import { classicV1DataSchema, themeTokensSchema } from "@ecs/storefront-templates";

import { mergeStorefrontTemplateDefaults } from "./template-service.js";

test("mergeStorefrontTemplateDefaults restores required static template keys", () => {
  const data = mergeStorefrontTemplateDefaults(
    {
      announcement: {
        enabled: true,
        text: "Now accepting orders online.",
      },
      header: {
        navigation: [
          { label: "Shop", href: "/" },
          { label: "Contact", href: "#contact" },
        ],
      },
      home: {
        hero: {
          title: "Your shop, online",
          subtitle: "Browse products and place an order in minutes.",
          primaryCtaLabel: "Shop products",
          primaryCtaHref: "/",
        },
        featuredProducts: {
          title: "Featured products",
          productIds: [],
        },
      },
      footer: {
        socialLinks: [],
      },
    },
    {
      announcement: {
        text: "Hello World",
      },
      header: {
        navigation: [{ label: "Test", href: "/" }],
      },
      home: {
        hero: {
          title: "Your shop, Hello World",
          primaryCtaLabel: "Shop products",
          primaryCtaHref: "/",
        },
        featuredProducts: {
          title: "Featured products",
        },
      },
      footer: {
        address: "Addis Ababa",
      },
    },
  );

  const parsed = classicV1DataSchema.parse(data);

  assert.equal(parsed.announcement?.enabled, true);
  assert.deepEqual(parsed.home.featuredProducts.productIds, []);
  assert.deepEqual(parsed.footer.socialLinks, []);
});

test("mergeStorefrontTemplateDefaults restores required strings cleared in the editor", () => {
  const data = mergeStorefrontTemplateDefaults(
    {
      header: {
        navigation: [{ label: "Shop", href: "/" }],
      },
      home: {
        hero: {
          title: "Your shop, online",
          primaryCtaLabel: "Shop products",
          primaryCtaHref: "/",
        },
        featuredProducts: {
          title: "Featured products",
          productIds: [],
        },
      },
      footer: {
        socialLinks: [],
      },
    },
    {
      header: {
        navigation: [{ label: "", href: "/" }],
      },
      home: {
        hero: {
          title: "",
          primaryCtaLabel: "",
          primaryCtaHref: "/",
        },
        featuredProducts: {
          title: "",
        },
      },
      footer: {
        socialLinks: [],
      },
    },
  );

  const parsed = classicV1DataSchema.parse(data);

  assert.equal(parsed.header.navigation[0]?.label, "Shop");
  assert.equal(parsed.home.hero.title, "Your shop, online");
  assert.equal(parsed.home.hero.primaryCtaLabel, "Shop products");
  assert.equal(parsed.home.featuredProducts.title, "Featured products");
});


test("mergeStorefrontTemplateDefaults restores required theme token keys", () => {
  const themeTokens = mergeStorefrontTemplateDefaults(
    {
      colors: {
        background: "#ffffff",
        foreground: "#111827",
        primary: "#0f766e",
        muted: "#f3f4f6",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
      },
      radius: "sm",
    },
    {
      colors: {
        primary: "#000000",
      },
    },
  );

  const parsed = themeTokensSchema.parse(themeTokens);

  assert.equal(parsed.colors.primary, "#000000");
  assert.equal(parsed.colors.background, "#ffffff");
  assert.equal(parsed.typography.bodyFont, "Inter");
  assert.equal(parsed.radius, "sm");
});
