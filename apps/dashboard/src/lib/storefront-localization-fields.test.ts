import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nexahubV1Defaults } from "@ecs/storefront-templates";
import {
  getStorefrontTranslationFields,
  getStorefrontTranslationStatus,
  hashStorefrontSource,
} from "./storefront-localization-fields.js";

describe("storefront localization fields", () => {
  it("derives only merchant-facing localized fields from the template manifest", () => {
    const fields = getStorefrontTranslationFields({
      data: nexahubV1Defaults,
      seo: {
        description: "A trusted technology shop in Addis Ababa.",
        socialImageUrl: null,
        title: "NexaHub Ethiopia",
      },
      templateKey: "nexahub@1",
    });

    assert.ok(fields.length > 10);
    assert.ok(fields.some((field) => field.path === "home.hero.title"));
    assert.equal(
      fields.some((field) => field.path.startsWith("header.navigation")),
      false,
    );
    assert.ok(fields.some((field) => field.path === "seo.title"));
    assert.ok(fields.some((field) => field.path === "seo.description"));
    assert.equal(
      fields.some((field) => field.path.startsWith("footer.phone")),
      false,
    );
    assert.equal(
      fields.some((field) => field.path.startsWith("footer.socialLinks")),
      false,
    );
    assert.equal(
      fields.some((field) => field.path === "footer.blurb"),
      false,
    );
    assert.equal(
      fields.some((field) => /color|asset|href|productIds/i.test(field.path)),
      false,
    );
    assert.equal(new Set(fields.map((field) => field.id)).size, fields.length);
  });

  it("distinguishes English fallback, current translations, and stale translations", () => {
    const field = getStorefrontTranslationFields({
      data: nexahubV1Defaults,
      templateKey: "nexahub@1",
    }).find((candidate) => candidate.path === "home.hero.title");
    assert.ok(field);

    assert.equal(
      getStorefrontTranslationStatus({
        field,
        locale: "am",
        localizedContent: { version: 1, locales: {} },
      }),
      "using_english",
    );
    assert.equal(
      getStorefrontTranslationStatus({
        field,
        locale: "am",
        localizedContent: {
          version: 1,
          locales: {
            am: {
              [field.path]: {
                sourceHash: hashStorefrontSource(field.source),
                value: "የተተረጎመ ይዘት",
              },
            },
          },
        },
      }),
      "ready",
    );
    assert.equal(
      getStorefrontTranslationStatus({
        field,
        locale: "am",
        localizedContent: {
          version: 1,
          locales: {
            am: {
              [field.path]: {
                sourceHash: "0".repeat(64),
                value: "የቆየ ትርጉም",
              },
            },
          },
        },
      }),
      "needs_review",
    );
  });

  it("omits blank source and SEO fields from readiness counts", () => {
    const data = structuredClone(nexahubV1Defaults);
    data.home.hero.title = "   ";
    const fields = getStorefrontTranslationFields({
      data,
      seo: { description: "", socialImageUrl: null, title: "   " },
      templateKey: "nexahub@1",
    });

    assert.equal(
      fields.some((field) => field.path === "home.hero.title"),
      false,
    );
    assert.equal(
      fields.some((field) => field.sectionId === "seo"),
      false,
    );
  });

  it("uses a template translation only while the matching English default is unchanged", () => {
    const defaults = getStorefrontTranslationFields({
      data: nexahubV1Defaults,
      templateKey: "nexahub@1",
    });
    const cta = defaults.find((field) => field.path === "home.hero.primaryCtaLabel");
    assert.equal(cta?.source, "Our Products");
    assert.equal(cta?.defaultTranslation, "ምርቶቻችን");
    assert.equal(
      cta &&
        getStorefrontTranslationStatus({
          field: cta,
          locale: "am",
          localizedContent: { version: 1, locales: {} },
        }),
      "ready",
    );

    const customized = structuredClone(nexahubV1Defaults);
    customized.home.hero.primaryCtaLabel = "Browse products";
    const customizedHome = getStorefrontTranslationFields({
      data: customized,
      templateKey: "nexahub@1",
    }).find((field) => field.path === "header.navigation.0.label");
    assert.equal(customizedHome?.defaultTranslation, undefined);
  });
});
