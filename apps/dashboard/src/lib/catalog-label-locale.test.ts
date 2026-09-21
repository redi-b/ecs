import assert from "node:assert/strict";
import test from "node:test";

import { resolveCatalogDisplayLocale } from "./catalog-label-locale";

test("match follows the dashboard language", () => {
  assert.equal(resolveCatalogDisplayLocale("match", "am"), "am");
  assert.equal(resolveCatalogDisplayLocale("match", "en"), "en");
});

test("pinned modes ignore the dashboard language", () => {
  assert.equal(resolveCatalogDisplayLocale("en", "am"), "en");
  assert.equal(resolveCatalogDisplayLocale("am", "en"), "am");
});
