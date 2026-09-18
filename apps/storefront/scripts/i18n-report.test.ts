import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationCoverage } from "./i18n-report.js";

test("reports missing, empty, cloned, and placeholder-breaking translations", () => {
  const report = createTranslationCoverage(
    { greeting_title: "Hello {name}", cart_empty: "Empty", language_english: "English" },
    { greeting_title: "ሰላም {person}", cart_empty: "Empty", language_english: "English", extra_key: "x" },
  );
  assert.deepEqual(report.placeholderMismatch, ["greeting_title"]);
  assert.deepEqual(report.untranslatedClones, ["cart_empty"]);
  assert.deepEqual(report.extra, ["extra_key"]);
  assert.equal(report.translated, 1);
});
