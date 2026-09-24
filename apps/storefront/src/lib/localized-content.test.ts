import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { applyLocalizedContent } from "./localized-content.js";

test("applies stable manifest field translations without changing the source draft", () => {
  const source = { home: { hero: { title: "New arrivals", enabled: true } } };
  const translated = applyLocalizedContent({
    source,
    locale: "am",
    content: {
      version: 1,
      locales: {
        am: {
          "home.hero.title": {
            value: "አዲስ የገቡ",
            sourceHash: createHash("sha256").update("New arrivals").digest("hex"),
          },
        },
      },
    },
  });
  assert.equal(translated.home.hero.title, "አዲስ የገቡ");
  assert.equal(source.home.hero.title, "New arrivals");
  assert.equal(translated.home.hero.enabled, true);
});

test("applies template defaults to array fields only while their English source is unchanged", () => {
  const defaults = {
    "header.navigation.0.label": { source: "Home", value: "መነሻ" },
  };
  const source = { header: { navigation: [{ label: "Home" }] } };
  const translated = applyLocalizedContent({
    source,
    locale: "am",
    content: { version: 1, locales: {} },
    defaults,
  });
  assert.equal(translated.header.navigation[0]?.label, "መነሻ");
  assert.equal(source.header.navigation[0]?.label, "Home");

  const customized = { header: { navigation: [{ label: "Welcome" }] } };
  const unchanged = applyLocalizedContent({
    source: customized,
    locale: "am",
    content: { version: 1, locales: {} },
    defaults,
  });
  assert.equal(unchanged.header.navigation[0]?.label, "Welcome");
});

test("lets a merchant translation override a template default", () => {
  const source = { header: { navigation: [{ label: "Home" }] } };
  const translated = applyLocalizedContent({
    source,
    locale: "am",
    defaults: {
      "header.navigation.0.label": { source: "Home", value: "መነሻ" },
    },
    content: {
      version: 1,
      locales: {
        am: {
          "header.navigation.0.label": {
            value: "የእኔ መነሻ",
            sourceHash: "a".repeat(64),
          },
        },
      },
    },
  });
  assert.equal(translated.header.navigation[0]?.label, "የእኔ መነሻ");
});
