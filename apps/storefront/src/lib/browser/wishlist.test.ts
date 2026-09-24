import assert from "node:assert/strict";
import test from "node:test";
import { createWishlistStore, normalizeWishlistEntry, wishlistStorageKey } from "./wishlist";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
};

test("normalizes legacy paths and structured wishlist entries", () => {
  assert.deepEqual(normalizeWishlistEntry("/products/glow-serum"), {
    path: "/products/glow-serum",
    title: "glow serum",
    thumbnail: null,
    priceAmount: null,
    currencyCode: null,
  });
  assert.equal(normalizeWishlistEntry({ title: "Missing path" }), null);
});

test("wishlist store migrates, de-duplicates, toggles, and removes entries", () => {
  const storage = memoryStorage();
  const key = wishlistStorageKey("shop.example");
  storage.setItem(key, JSON.stringify([
    "/products/glow-serum",
    { path: "/products/glow-serum", title: "Glow Serum", priceAmount: 1200 },
  ]));
  const store = createWishlistStore(storage, "shop.example");
  assert.deepEqual(store.read(), [{
    path: "/products/glow-serum",
    title: "Glow Serum",
    thumbnail: null,
    priceAmount: 1200,
    currencyCode: null,
  }]);
  assert.equal(store.toggle({ path: "/products/night-cream", title: "Night Cream" }).length, 2);
  assert.equal(store.toggle({ path: "/products/night-cream", title: "Night Cream" }).length, 1);
  assert.deepEqual(store.remove("/products/glow-serum"), []);
  store.write([{ path: "/products/account-only", title: "Account only", thumbnail: null, priceAmount: null, currencyCode: null }]);
  store.clear();
  assert.equal(storage.getItem(key), null);
  assert.deepEqual(store.read(), []);
});
