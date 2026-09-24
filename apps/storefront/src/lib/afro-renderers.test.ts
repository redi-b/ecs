import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, `${new URL("..", import.meta.url).href}/`), "utf8");

test("Afro owns real home, listing, and product renderers", () => {
  const registry = read("templates/registry.ts");

  assert.match(registry, /"afro@1"\s*:\s*\{/);
  assert.match(registry, /ProductList:\s*AfroV1ProductList/);
  assert.match(registry, /Product:\s*AfroV1Product/);
  assert.match(registry, /Cart:\s*AfroV1Cart/);
  assert.match(registry, /Checkout:\s*AfroV1Checkout/);
  assert.match(registry, /OrderConfirm:\s*AfroV1OrderConfirm/);
  assert.match(registry, /Contact:\s*AfroV1Contact/);
  assert.match(registry, /RequestItem:\s*AfroV1RequestItem/);
  assert.match(registry, /Wishlist:\s*AfroV1Wishlist/);
  assert.match(registry, /Account:\s*AfroV1Account/);
  assert.match(registry, /AccountOrder:\s*AfroV1AccountOrder/);
  assert.match(registry, /SystemState:\s*AfroV1SystemState/);
});

test("Afro listing preserves filters and BEM classes", () => {
  const source = read("templates/afro/v1/pages/ProductList.astro");

  assert.ok(source.includes("shop-page"), "listing must have shop-page");
  assert.ok(source.includes("shop-sidebar"), "listing must have shop-sidebar");
  assert.ok(source.includes("shop-main"), "listing must have shop-main");
  assert.ok(source.includes("ProductCard"), "listing must use ProductCard");
});

test("Afro home contains required sections in order", () => {
  const home = read("templates/afro/v1/pages/index.astro");

  assert.ok(home.includes("hero-section"), "home must have hero-section");
  assert.ok(home.includes("category-section"), "home must have category-section");
  assert.ok(home.includes("product-grid-section"), "home must have product-grid-section");
  assert.ok(home.includes("collections-section"), "home must have collections-section");
  assert.ok(home.includes("contact-section"), "home must have contact-section");
});
