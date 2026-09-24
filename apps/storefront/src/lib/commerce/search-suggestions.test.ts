import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSearchSuggestionMoney, toStoreSearchSuggestions } from "./search-suggestions.js";
import type { StoreProduct } from "./types.js";

const product = (input: Partial<StoreProduct> = {}): StoreProduct => ({
  categoryIds: [],
  collectionId: null,
  collectionTitle: "Coffee",
  currencyCode: "etb",
  description: null,
  handle: "buna-set",
  id: "prod_1",
  images: [],
  gallery: [],
  options: [],
  priceAmount: 1250,
  thumbnail: "/media/buna.webp",
  title: "Buna Set",
  variants: [],
  ...input,
});

test("search suggestions expose only customer-facing product context", () => {
  assert.deepEqual(toStoreSearchSuggestions([product()]), [{
    collection: "Coffee",
    handle: "buna-set",
    price: "ETB 1,250",
    thumbnail: "/media/buna.webp",
    title: "Buna Set",
  }]);
});

test("search suggestions omit products without a usable route or title", () => {
  assert.deepEqual(toStoreSearchSuggestions([
    product({ handle: null }),
    product({ id: "prod_2", title: " " }),
  ]), []);
});

test("search suggestion money is truthful when price is unavailable", () => {
  assert.equal(formatSearchSuggestionMoney(null, "etb"), null);
  assert.equal(formatSearchSuggestionMoney(50, "not-a-currency"), "NOT-A-CURRENCY 50");
});
