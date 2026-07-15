import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTranslator } from "next-intl";

import { locales, type AppLocale } from "./config";
import { messagesByLocale } from "./messages";

type LeafMap = Record<string, string>;

function flatten(messages: unknown, prefix = ""): LeafMap {
  const out: LeafMap = {};
  if (!messages || typeof messages !== "object") return out;

  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else if (typeof value === "string") {
      out[path] = value;
    }
  }
  return out;
}

function placeholderNames(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

function normalizeForPlaceholders(message: string): string {
  return message.replace(/''/g, "'");
}

describe("i18n message catalogs", () => {
  const englishLeaves = flatten(messagesByLocale.en);
  const englishKeys = Object.keys(englishLeaves).sort();

  it("registers every configured locale", () => {
    for (const locale of locales) {
      assert.ok(messagesByLocale[locale], `missing catalog for locale ${locale}`);
    }
  });

  it("keeps the same nested key paths as English for every locale", () => {
    assert.equal(englishKeys.length > 0, true);

    for (const locale of locales) {
      if (locale === "en") continue;

      const localeKeys = Object.keys(flatten(messagesByLocale[locale])).sort();
      assert.deepEqual(
        localeKeys,
        englishKeys,
        `${locale} keys must match en (got ${localeKeys.length}, en has ${englishKeys.length})`,
      );
    }
  });

  it("preserves {placeholder} names for every key across locales", () => {
    const mismatches: string[] = [];

    for (const locale of locales) {
      if (locale === "en") continue;
      const leaves = flatten(messagesByLocale[locale]);

      for (const key of englishKeys) {
        const expected = placeholderNames(normalizeForPlaceholders(englishLeaves[key] ?? ""));
        const actual = placeholderNames(normalizeForPlaceholders(leaves[key] ?? ""));
        if (expected.join(",") !== actual.join(",")) {
          mismatches.push(
            `${locale}:${key} expected {${expected.join(", ")}} got {${actual.join(", ")}}`,
          );
        }
      }
    }

    assert.deepEqual(mismatches, [], mismatches.join("\n"));
  });

  it("does not ship empty message strings", () => {
    const empties: string[] = [];

    for (const locale of locales) {
      for (const [key, value] of Object.entries(flatten(messagesByLocale[locale as AppLocale]))) {
        if (value.trim().length === 0) {
          empties.push(`${locale}:${key}`);
        }
      }
    }

    assert.deepEqual(empties, [], `empty messages:\n${empties.join("\n")}`);
  });

  it("resolves nested paths through next-intl (including renamed conflict keys)", () => {
    const t = createTranslator({ locale: "en", messages: messagesByLocale.en });

    assert.equal(t("nav.products"), "Products");
    assert.equal(t("auth.brandFooter.label"), englishLeaves["auth.brandFooter.label"]);
    assert.equal(t("auth.brandFooter.signIn"), englishLeaves["auth.brandFooter.signIn"]);
    assert.equal(t("taxonomy.entity.category.label"), englishLeaves["taxonomy.entity.category.label"]);
    assert.equal(
      t("taxonomy.entity.category.plural"),
      englishLeaves["taxonomy.entity.category.plural"],
    );
    // ICU unescapes '' → ' in rendered output
    assert.equal(
      t("media.importUrlHint"),
      normalizeForPlaceholders(englishLeaves["media.importUrlHint"] ?? ""),
    );
    assert.equal(t("onboarding.stepOf", { current: 1, total: 3 }), "Step 1 of 3");
  });
});
