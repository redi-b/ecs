import test from "node:test";
import assert from "node:assert/strict";
import {
  $wishlist,
  $wishlistCount,
  setWishlist,
  toggleWishlist,
  removeWishlistItem,
  isItemWishlisted,
} from "./wishlist";

test("wishlist nanostore toggles and computes count correctly", async () => {
  setWishlist([], false);
  assert.equal($wishlistCount.get(), 0);

  const item1 = {
    path: "/products/jacket",
    title: "Jacket",
    thumbnail: "/jacket.jpg",
    priceAmount: 1200,
    currencyCode: "ETB",
  };

  await toggleWishlist(item1);
  assert.equal($wishlistCount.get(), 1);
  assert.equal(isItemWishlisted("/products/jacket"), true);

  await toggleWishlist(item1);
  assert.equal($wishlistCount.get(), 0);
  assert.equal(isItemWishlisted("/products/jacket"), false);
});
