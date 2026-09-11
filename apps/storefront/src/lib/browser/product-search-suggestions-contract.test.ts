import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("production template search entry points use the shared accessible suggestion controller", async () => {
  const [luviaLayout, luviaListing, nexahubLayout, controller] = await Promise.all([
    source("../../templates/luvia/v1/Layout.astro"),
    source("../../templates/luvia/v1/ProductList.astro"),
    source("../../templates/nexahub/v1/Layout.astro"),
    source("./product-search-suggestions.ts"),
  ]);

  for (const entry of [luviaLayout, luviaListing, nexahubLayout]) {
    assert.match(entry, /data-product-search-suggestions/);
    assert.match(entry, /initProductSearchSuggestions/);
  }
  assert.match(controller, /aria-autocomplete/);
  assert.match(controller, /AbortController/);
  assert.match(controller, /ArrowDown/);
  assert.match(controller, /ArrowUp/);
  assert.match(controller, /Escape/);
});
