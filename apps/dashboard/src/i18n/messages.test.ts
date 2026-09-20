import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTranslator } from "next-intl";

import { type AppLocale, locales } from "./config";
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
  return [...message.matchAll(/\{(\w+)\}/g)]
    .flatMap((match) => (match[1] ? [match[1]] : []))
    .sort();
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

  it("does not silently copy ordinary English labels into Amharic", () => {
    const amharicLeaves = flatten(messagesByLocale.am);
    const allowedSharedValues = new Set([
      "+251…",
      "100 KB – 1 MB",
      "IP",
      "Mac",
      "SEO",
      "SKU",
      "SKU {sku}",
      "Telegram",
      "product-name",
      "customer@example.com",
      "buyer@example.com",
      "https://example.com/photo.jpg",
      "iPad",
      "iPhone",
      "you@business.com",
    ]);
    const copied = englishKeys.filter((key) => {
      const english = englishLeaves[key] ?? "";
      const visibleEnglish = english.replace(/\{\w+\}/g, "");
      return (
        english === amharicLeaves[key] &&
        /[A-Za-z]{3}/.test(visibleEnglish) &&
        !allowedSharedValues.has(english)
      );
    });

    assert.deepEqual(copied, [], `English labels copied into Amharic:\n${copied.join("\n")}`);
  });

  it("resolves nested paths through next-intl (including renamed conflict keys)", () => {
    const t = createTranslator({ locale: "en", messages: messagesByLocale.en });

    assert.equal(t("nav.products"), "Products");
    assert.equal(t("auth.brandFooter.label"), englishLeaves["auth.brandFooter.label"]);
    assert.equal(t("auth.brandFooter.signIn"), englishLeaves["auth.brandFooter.signIn"]);
    assert.equal(
      t("taxonomy.entity.category.label"),
      englishLeaves["taxonomy.entity.category.label"],
    );
    assert.equal(
      t("taxonomy.entity.category.plural"),
      englishLeaves["taxonomy.entity.category.plural"],
    );
    assert.equal(t("onboarding.stepOf", { current: 1, total: 3 }), "Step 1 of 3");
  });

  it("enforces authentic Amharic localization rules and bans calques", () => {
    const amharicLeaves = flatten(messagesByLocale.am);
    const violations: string[] = [];

    for (const key of englishKeys) {
      const en = englishLeaves[key] ?? "";
      const am = amharicLeaves[key] ?? "";

      // 1. Ban root ያክሉ / ማከል in favor of ይጨምሩ / መጨመር
      if (/(ያክሉ|ማከል|ያክሏ|ለማከል|ያክላል|አክሉ|አክል)/.test(am)) {
        violations.push(`${key}: banned add root in "${am}"`);
      }

      // 2. Ban ማደስ for refresh (allow billing renewal)
      if (
        /(ማደስ|ያድሱ|አድስ|አድሰው|ታደሰ|እየታደሰ|ታድሷል)/.test(am) &&
        !/renew|subscription|period/i.test(en) &&
        !key.startsWith("billing.")
      ) {
        violations.push(`${key}: banned refresh root in "${am}"`);
      }

      // 3. Ban በመጫን ላይ and አልተጫኑ/አልተጫነ for data loading
      if (/በመጫን ላይ|አልተጫኑ|አልተጫነ/.test(am)) {
        violations.push(`${key}: banned loading root in "${am}"`);
      }

      // 4. Ban መስክ / መስኮች calque for form/input fields
      if (/(መስክ|መስኮች)/.test(am)) {
        violations.push(`${key}: banned form field calque in "${am}"`);
      }

      // 5. Ban የመስመር እቃ calque
      if (/የመስመር እቃ/.test(am)) {
        violations.push(`${key}: banned line item calque in "${am}"`);
      }

      // 6. Ban የመስመር ላይ / ከመስመር ውጭ calques
      if (/(የ|በ|ከ)?መስመር\s*(ላይ|ውጭ)/.test(am)) {
        violations.push(`${key}: banned online/offline calque in "${am}"`);
      }

      // 7. Ban አማራጭ for optional form fields
      if (/optional/i.test(en) && /አማራጭ/.test(am)) {
        violations.push(`${key}: optional translated as አማራጭ in "${am}"`);
      }

      // 8. Ban em dashes in copy (allow standalone placeholder "—")
      if (/—/.test(am) && am.trim() !== "—") {
        violations.push(`${key}: em-dash in copy "${am}"`);
      }

      // 9. Ban profile/stock/logo/browse calques
      if (/መገለጫ/.test(am)) {
        violations.push(`${key}: banned መገለጫ calque in "${am}"`);
      }
      if (/ማከማቻ/.test(am)) {
        violations.push(`${key}: banned ማከማቻ calque in "${am}"`);
      }
      if (/አርማ/.test(am)) {
        violations.push(`${key}: banned አርማ calque in "${am}"`);
      }
      if (/(አስስ|ያስሱ|ማሰስ)/.test(am)) {
        violations.push(`${key}: banned browse calque in "${am}"`);
      }
      if (/ይፋዊ/.test(am) || /ይፋ\s*ያድርጉ/.test(am)) {
        violations.push(`${key}: banned official/public calque in "${am}"`);
      }
    }

    // Also assert on storefront message catalog
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const sfEnPath = path.resolve(currentDir, "../../../storefront/messages/en.json");
      const sfAmPath = path.resolve(currentDir, "../../../storefront/messages/am.json");
      if (fs.existsSync(sfEnPath) && fs.existsSync(sfAmPath)) {
        const sfEn = JSON.parse(fs.readFileSync(sfEnPath, "utf8")) as Record<string, string>;
        const sfAm = JSON.parse(fs.readFileSync(sfAmPath, "utf8")) as Record<string, string>;
        for (const [key, enVal] of Object.entries(sfEn)) {
          const en = String(enVal);
          const am = String(sfAm[key] ?? "");
          const sfKey = `storefront.${key}`;

          if (/(ያክሉ|ማከል|ያክሏ|ለማከል|ያክላል|አክሉ|አክል)/.test(am)) {
            violations.push(`${sfKey}: banned add root in "${am}"`);
          }
          if (/(ማደስ|ያድሱ|አድስ|አድሰው|ታደሰ|እየታደሰ|ታድሷል)/.test(am)) {
            violations.push(`${sfKey}: banned refresh root in "${am}"`);
          }
          if (/በመጫን ላይ|አልተጫኑ|አልተጫነ/.test(am)) {
            violations.push(`${sfKey}: banned loading root in "${am}"`);
          }
          if (/(መስክ|መስኮች)/.test(am)) {
            violations.push(`${sfKey}: banned form field calque in "${am}"`);
          }
          if (/የመስመር እቃ/.test(am)) {
            violations.push(`${sfKey}: banned line item calque in "${am}"`);
          }
          if (/(የ|በ|ከ)?መስመር\s*(ላይ|ውጭ)/.test(am)) {
            violations.push(`${sfKey}: banned online/offline calque in "${am}"`);
          }
          if (/optional/i.test(en) && /አማራጭ/.test(am)) {
            violations.push(`${sfKey}: optional translated as አማራጭ in "${am}"`);
          }
          if (/—/.test(am) && am.trim() !== "—") {
            violations.push(`${sfKey}: em-dash in copy "${am}"`);
          }
          if (/መገለጫ/.test(am)) {
            violations.push(`${sfKey}: banned መገለጫ calque in "${am}"`);
          }
          if (/ማከማቻ/.test(am)) {
            violations.push(`${sfKey}: banned ማከማቻ calque in "${am}"`);
          }
          if (/አርማ/.test(am)) {
            violations.push(`${sfKey}: banned አርማ calque in "${am}"`);
          }
          if (/(አስስ|ያስሱ|ማሰስ)/.test(am)) {
            violations.push(`${sfKey}: banned browse calque in "${am}"`);
          }
          if (/ይፋዊ/.test(am) || /ይፋ\s*ያድርጉ/.test(am)) {
            violations.push(`${sfKey}: banned official/public calque in "${am}"`);
          }
        }
      }
    } catch {
      // ignore if storefront directory not present in standalone build
    }

    assert.deepEqual(violations, [], `Linguistic rule violations:\n${violations.join("\n")}`);
  });
});
