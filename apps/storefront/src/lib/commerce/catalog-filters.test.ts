import assert from "node:assert/strict";
import test from "node:test";

import { catalogHref, parseCatalogFilters, parseOptionPair } from "./catalog-filters";

test("parses bounded product filters and repeated option values", () => {
  const token = JSON.stringify(["Size", "Large"]);
  const filters = parseCatalogFilters(new URLSearchParams([
    ["q", "  shirt  "], ["option", token], ["option", token],
    ["price_min", "500"], ["price_max", "2500"], ["order", "price"],
  ]));
  assert.deepEqual(filters, {
    q: "shirt", optionPairs: [token], priceMin: 500, priceMax: 2500, order: "price",
  });
  assert.deepEqual(parseOptionPair(token), { name: "Size", value: "Large" });
  assert.equal(catalogHref(filters), `/products?q=shirt&option=${encodeURIComponent(token)}&price_min=500&price_max=2500&order=price`);
});

test("drops malformed catalog filters", () => {
  assert.deepEqual(parseCatalogFilters(new URLSearchParams("option=nope&price_min=-1&order=random")), {
    optionPairs: [],
  });
});
