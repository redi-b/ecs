import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastingInk,
  contrastRatio,
  getBrandPresets,
  getStartingBrandTokens,
  storefrontTemplates,
} from "@ecs/storefront-templates";
import { applyShopDetails, createBrandedShopData } from "./shop-details.js";

const details = {
  version: 1,
  categories: ["Fashion"],
  description: "Made in Addis",
  primaryPhone: "+251912345678",
  additionalPhones: ["+251911111111"],
  publicEmail: "",
  socialProfiles: [{ platform: "instagram", url: "https://instagram.com/shop" }],
};

test("new shop data and every preset satisfy both template contracts", () => {
  for (const template of storefrontTemplates) {
    const original = structuredClone(template.defaultData);
    const branded = createBrandedShopData(template.defaultData, "My shop", details);
    assert.equal(template.schema.safeParse(branded).success, true, template.templateKey);
    assert.deepEqual(template.defaultData, original, "never mutate reusable demo data");
    const parsed = branded as {
      header: { useShopName: boolean; logoAssetId?: string };
      footer: {
        phone: string;
        additionalPhones: string[];
        email?: string;
        socialLinks: { label: string }[];
      };
    };
    assert.deepEqual(
      parsed.header,
      (original as { header: typeof parsed.header }).header,
      `: preserve the template header`,
    );
    assert.deepEqual(
      (branded as { home?: unknown }).home,
      (original as { home?: unknown }).home,
      `: preserve the template home copy`,
    );
    assert.equal(parsed.footer.email, undefined);
    assert.deepEqual(parsed.footer.additionalPhones, details.additionalPhones);
    assert.equal(parsed.footer.socialLinks[0]?.label, "Instagram");
    for (const preset of getBrandPresets(template.templateKey)) {
      for (const background of [
        preset.colors.background,
        preset.colors.muted,
        preset.colors.accent,
      ])
        assert.ok(
          contrastRatio(preset.colors.foreground, background) >= 4.5,
          `${template.templateKey}/${preset.id}: readable text`,
        );
      assert.ok(
        contrastRatio(contrastingInk(preset.colors.primary), preset.colors.primary) >= 4.5,
        `${template.templateKey}/${preset.id}: readable button`,
      );
      const startingTokens = getStartingBrandTokens(
        template.templateKey,
        template.defaultThemeTokens,
        { presetId: preset.id },
      );
      assert.equal(
        template.themeSchema.safeParse(startingTokens).success,
        true,
        `${template.templateKey}/${preset.id}`,
      );
      assert.deepEqual(
        (startingTokens as { colors: unknown }).colors,
        preset.colors,
        `${template.templateKey}/${preset.id}: selected palette is applied`,
      );
    }
  }
});

test("live contact changes clear removed fields without replacing a custom logo", () => {
  const data = {
    header: { logoAssetId: "custom-logo" },
    footer: {
      email: "old@example.com",
      address: "Old address",
      socialLinks: [{ label: "Old", href: "https://example.com" }],
    },
  };
  const updated = applyShopDetails(data, { ...details, socialProfiles: [] }) as typeof data;
  assert.equal(updated.header.logoAssetId, "custom-logo");
  assert.equal(updated.footer.email, undefined);
  assert.equal(updated.footer.address, undefined);
  assert.deepEqual(updated.footer.socialLinks, []);
  assert.equal(applyShopDetails(data, null), data, "legacy designs remain untouched");
});
