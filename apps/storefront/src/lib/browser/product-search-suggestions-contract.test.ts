import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { initProductSearchSuggestions } from "./product-search-suggestions";

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

test("shared search guards blank and whitespace-only submit before navigation", async () => {
  const controller = await source("./product-search-suggestions.ts");
  assert.match(controller, /form\.addEventListener\("submit"/);
  assert.match(controller, /!input\.value\.trim\(\)/);
});

test("search submission blocks empty terms, focuses the field, and permits actual searches", () => {
  const originalDocument = globalThis.document;
  const handlers = new Map<string, (event: Event) => void>();
  let focused = false;
  const input = {
    id: "search",
    value: "",
    closest: () => null,
    setAttribute: () => {},
    addEventListener: () => {},
    focus: () => {
      focused = true;
    },
  };
  const form = {
    dataset: {},
    querySelector: () => input,
    append: () => {},
    addEventListener: (name: string, callback: (event: Event) => void) =>
      handlers.set(name, callback),
  };
  globalThis.document = {
    documentElement: { lang: "en" },
    createElement: () => ({ setAttribute: () => {} }),
    addEventListener: () => {},
  } as unknown as Document;
  try {
    initProductSearchSuggestions(form as unknown as HTMLFormElement);
    for (const term of ["", "  \t ", "shirt", "  shirt  "]) {
      input.value = term;
      focused = false;
      const event = new Event("submit", { cancelable: true });
      handlers.get("submit")?.(event);
      assert.equal(event.defaultPrevented, !term.trim());
      assert.equal(focused, !term.trim());
    }
  } finally {
    globalThis.document = originalDocument;
  }
});
