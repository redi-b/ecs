import assert from "node:assert/strict";
import test from "node:test";

import { catalogDisplayName } from "./catalog-display-name";

const translation = {
  locale: "am" as const,
  status: "ready" as const,
  title: "የምሽት ቀሚስ",
};

test("English display uses the source name and keeps Amharic for the popover", () => {
  const result = catalogDisplayName({
    displayLocale: "en",
    source: "Midnight dress",
    translation,
    untitled: "Untitled",
  });
  assert.equal(result.primary, "Midnight dress");
  assert.equal(result.other, "የምሽት ቀሚስ");
  assert.equal(result.otherLang, "am");
});

test("Amharic display uses the translation when present and falls back to source", () => {
  assert.equal(
    catalogDisplayName({
      displayLocale: "am",
      source: "Midnight dress",
      translation,
      untitled: "Untitled",
    }).primary,
    "የምሽት ቀሚስ",
  );
  assert.equal(
    catalogDisplayName({
      displayLocale: "am",
      source: "Midnight dress",
      translation: { locale: "am", status: "using_english", title: null },
      untitled: "Untitled",
    }).primary,
    "Midnight dress",
  );
});
