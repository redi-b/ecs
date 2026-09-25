import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("production template search entry points use the shared accessible suggestion controller", async () => {
  const [luviaHeader, luviaListing, nexahubLayout, luviaClient, controller] = await Promise.all([
    source("../../templates/luvia/v1/components/Header.astro"),
    source("../../templates/luvia/v1/pages/ProductList.astro"),
    source("../../templates/nexahub/v1/layouts/Layout.astro"),
    source("../../templates/luvia/v1/scripts/client.ts"),
    source("./product-search-suggestions.ts"),
  ]);

  for (const entry of [luviaHeader, luviaListing, nexahubLayout]) {
    assert.match(entry, /data-product-search-suggestions/);
  }
  assert.match(luviaClient, /initProductSearchSuggestions/);
  assert.match(nexahubLayout, /initProductSearchSuggestions/);
  assert.match(controller, /aria-autocomplete/);
  assert.match(controller, /AbortController/);
  assert.match(controller, /ArrowDown/);
  assert.match(controller, /ArrowUp/);
  assert.match(controller, /Escape/);
});
