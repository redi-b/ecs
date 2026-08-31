import assert from "node:assert/strict";
import test from "node:test";

import {
  luviaV1Defaults,
  luviaV1ThemeTokens,
  nexahubV1Defaults,
  nexahubV1ThemeTokens,
} from "@ecs/storefront-templates";
import { z } from "zod";

import {
  isTrustedStorefrontSocialImage,
  normalizeStorefrontDraftPayload,
  normalizeStorefrontSeoSettings,
  resolveTemplateDraft,
} from "./template-service.js";

test("normalizes storefront SEO without carrying invalid or oversized values", () => {
  assert.deepEqual(
    normalizeStorefrontSeoSettings({
      title: "  Abebe Market  ",
      description: "x".repeat(161),
      socialImageUrl: 42,
    }),
    {
      title: "Abebe Market",
      description: null,
      socialImageUrl: null,
    },
  );
});

test("accepts social images only under the configured media base path", () => {
  const base = "https://media.example.com/tenants";
  assert.equal(
    isTrustedStorefrontSocialImage("https://media.example.com/tenants/t1/share.jpg", base),
    true,
  );
  assert.equal(
    isTrustedStorefrontSocialImage("https://media.example.com/tenant-lookalike.jpg", base),
    false,
  );
  assert.equal(
    isTrustedStorefrontSocialImage("https://evil.example/tenants/t1/share.jpg", base),
    false,
  );
  assert.equal(
    isTrustedStorefrontSocialImage("https://media.example.com/tenants/t1/share.jpg", undefined),
    false,
  );
  assert.equal(isTrustedStorefrontSocialImage(null, undefined), true);
});

test("normalizes a Luvia draft with the Luvia theme contract", () => {
  const normalized = normalizeStorefrontDraftPayload({
    data: luviaV1Defaults,
    templateKey: "luvia@1",
    themeTokens: luviaV1ThemeTokens,
  });

  assert.ok(normalized);
  assert.equal(normalized.themeTokens.colorMode, "light");
  assert.deepEqual(normalized.themeTokens, luviaV1ThemeTokens);
});

test("normalizes a NexaHub draft through the same registry boundary", () => {
  const data = structuredClone(nexahubV1Defaults);
  data.home.hero.title = "Merchant-authored NexaHub headline";
  const themeTokens = structuredClone(nexahubV1ThemeTokens);
  themeTokens.colors.primary = "#2457c5";

  const normalized = normalizeStorefrontDraftPayload({
    data,
    templateKey: "nexahub@1",
    themeTokens,
  });

  assert.ok(normalized);
  assert.equal(normalized.data.home.hero.title, "Merchant-authored NexaHub headline");
  assert.equal(normalized.themeTokens.colors.primary, "#2457c5");
  assert.equal(normalized.themeTokens.typography.headingFont, "Space Grotesk");
});

test("accepts NexaHub catalog selections when saving and publishing", () => {
  const data = structuredClone(nexahubV1Defaults);
  data.home.featuredItem.productIds = ["prod_selected", "prod_featured_second"];
  data.home.bestSellers.productIds = ["prod_selected", "prod_second"];
  data.home.categories.collectionIds = ["pcol_selected"];

  const normalized = normalizeStorefrontDraftPayload({
    data,
    templateKey: "nexahub@1",
    themeTokens: nexahubV1ThemeTokens,
  });

  assert.ok(normalized);
  const normalizedData = normalized.data as typeof data;
  assert.deepEqual(normalizedData.home.featuredItem.productIds, ["prod_selected", "prod_featured_second"]);
  assert.deepEqual(normalizedData.home.bestSellers.productIds, ["prod_selected", "prod_second"]);
  assert.deepEqual(normalizedData.home.categories.collectionIds, ["pcol_selected"]);
});

test("rejects cross-template payloads instead of coercing them", () => {
  assert.equal(
    normalizeStorefrontDraftPayload({
      data: luviaV1Defaults,
      templateKey: "nexahub@1",
      themeTokens: luviaV1ThemeTokens,
    }),
    undefined,
  );
});

test("normalizes a synthetic template through the generic template boundary", () => {
  const dataSchema = z.object({ headline: z.string() });
  const themeSchema = z.object({ primary: z.string() });
  const normalized = normalizeStorefrontDraftPayload({
    data: { headline: "Merchant headline" },
    templateKey: "test-template@1",
    themeTokens: { primary: "#123456" },
  }, () => ({
    defaultData: { headline: "Default headline" },
    defaultThemeTokens: { primary: "#000000" },
    schema: dataSchema,
    themeSchema,
  }));

  assert.ok(normalized);
  assert.deepEqual(normalized.data, { headline: "Merchant headline" });
  assert.deepEqual(normalized.themeTokens, { primary: "#123456" });
});

test("resumes a saved draft instead of replacing it with template defaults", () => {
  const saved = { data: { headline: "Merchant edit" }, themeTokens: { primary: "#123456" } };
  const result = resolveTemplateDraft({
    defaultData: { headline: "Default" },
    defaultThemeTokens: { primary: "#000000" },
    mode: "resume",
    saved,
  });

  assert.equal(result.source, "saved");
  assert.deepEqual(result.data, saved.data);
  assert.deepEqual(result.themeTokens, saved.themeTokens);
});

test("a clean template start explicitly uses registry defaults", () => {
  const defaults = { headline: "Default" };
  const theme = { primary: "#000000" };
  const result = resolveTemplateDraft({
    defaultData: defaults,
    defaultThemeTokens: theme,
    mode: "clean",
    saved: { data: { headline: "Merchant edit" }, themeTokens: { primary: "#123456" } },
  });

  assert.equal(result.source, "clean");
  assert.deepEqual(result.data, defaults);
  assert.deepEqual(result.themeTokens, theme);
});
